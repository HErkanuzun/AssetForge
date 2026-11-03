# AssetForge — iskelet adlarını Unreal 5 Manny/Quinn standardına çevirir.
# Desteklenen kaynaklar: Mixamo, Meshy otomatik rig, NVIDIA Kimodo SOMA (somaskel77).
# Blender içinden kullanılır (bpy gerekir).

import re

import bpy
from mathutils import Vector


def _norm(name):
    n = name.split(":")[-1]
    n = re.sub(r"^mixamorig", "", n, flags=re.I)
    return re.sub(r"[^a-z0-9]", "", n.lower())


def _sides(table):
    out = {}
    for src, dst in table.items():
        if "{s}" in src:
            out[src.format(s="left")] = dst.format(s="l")
            out[src.format(s="right")] = dst.format(s="r")
        else:
            out[src] = dst
    return out


FINGERS = ["index", "middle", "ring", "pinky"]

MIXAMO = {
    "hips": "pelvis", "spine": "spine_01", "spine1": "spine_02", "spine2": "spine_03",
    "spine01": "spine_02", "spine02": "spine_03",  # Meshy varyantı
    "neck": "neck_01", "head": "head",
    "{s}shoulder": "clavicle_{s}", "{s}arm": "upperarm_{s}", "{s}forearm": "lowerarm_{s}", "{s}hand": "hand_{s}",
    "{s}upleg": "thigh_{s}", "{s}leg": "calf_{s}", "{s}foot": "foot_{s}", "{s}toebase": "ball_{s}",
    "{s}handthumb1": "thumb_01_{s}", "{s}handthumb2": "thumb_02_{s}", "{s}handthumb3": "thumb_03_{s}",
}
for f in FINGERS:
    for i in (1, 2, 3):
        MIXAMO["{s}hand%s%d" % (f, i)] = "%s_0%d_{s}" % (f, i)

SOMA = {
    "hips": "pelvis", "spine1": "spine_01", "spine2": "spine_02", "chest": "spine_03",
    "neck1": "neck_01", "neck2": "neck_02", "head": "head",
    "{s}shoulder": "clavicle_{s}", "{s}arm": "upperarm_{s}", "{s}forearm": "lowerarm_{s}", "{s}hand": "hand_{s}",
    "{s}leg": "thigh_{s}", "{s}shin": "calf_{s}", "{s}foot": "foot_{s}", "{s}toebase": "ball_{s}",
    "{s}handthumb1": "thumb_01_{s}", "{s}handthumb2": "thumb_02_{s}", "{s}handthumb3": "thumb_03_{s}",
}
for f in FINGERS:
    SOMA["{s}hand%s1" % f] = "%s_metacarpal_{s}" % f
    for i in (2, 3, 4):
        SOMA["{s}hand%s%d" % (f, i)] = "%s_0%d_{s}" % (f, i - 1)

PROFILES = {"mixamo": _sides(MIXAMO), "soma": _sides(SOMA)}
MANNY_CORE = ["pelvis", "spine_01", "head", "upperarm_l", "upperarm_r", "hand_l", "hand_r", "thigh_l", "thigh_r", "foot_l", "foot_r"]


def detect_profile(names):
    n = {_norm(x) for x in names}
    if "pelvis" in n and "thighl" in n:
        return "manny"
    if "leftshin" in n or "chest" in n:
        return "soma"
    if "leftupleg" in n or "hips" in n:
        return "mixamo"
    return "unknown"


def to_manny(arm_obj, add_root=True):
    """Kemikleri Manny adlarına çevirir, gerekirse 'root' kemiği ekler. Rapor sözlüğü döner."""
    bones = [b.name for b in arm_obj.data.bones]
    profile = detect_profile(bones)
    report = {"profile": profile, "renamed": 0, "unmapped": [], "missing": []}
    if profile in PROFILES:
        table = PROFILES[profile]
        for b in arm_obj.data.bones:
            dst = table.get(_norm(b.name))
            if dst and b.name != dst:
                old = b.name
                b.name = dst  # Blender vertex group ve action kanallarını da günceller
                for o in bpy.data.objects:
                    if o.type == "MESH" and old in o.vertex_groups:
                        o.vertex_groups[old].name = dst
                report["renamed"] += 1
            elif not dst:
                report["unmapped"].append(b.name)
    names = {b.name for b in arm_obj.data.bones}
    report["missing"] = [m for m in MANNY_CORE if m not in names]

    if add_root and "root" not in names and "pelvis" in names:
        bpy.context.view_layer.objects.active = arm_obj
        bpy.ops.object.mode_set(mode="EDIT")
        eb = arm_obj.data.edit_bones
        root = eb.new("root")
        pelvis = eb["pelvis"]
        size = max((pelvis.head - Vector((0, 0, 0))).length, 0.1)
        root.head = Vector((0, 0, 0))
        root.tail = Vector((0, size * 0.25, 0))
        root.roll = 0
        old_parent = pelvis.parent
        pelvis.parent = root
        if old_parent is not None and old_parent.name != "root":
            old_parent.parent = root
        bpy.ops.object.mode_set(mode="OBJECT")
        report["root_added"] = True
    return report


def bake_root_motion(arm_obj, frame_start, frame_end):
    """Pelvisin zemin izdüşümünü 'root' kemiğine taşır (Unreal root motion için)."""
    scene = bpy.context.scene
    pb_root = arm_obj.pose.bones.get("root")
    pb_pel = arm_obj.pose.bones.get("pelvis")
    if not pb_root or not pb_pel:
        return False
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="POSE")
    frames = list(range(frame_start, frame_end + 1))
    pelvis_mats = []
    for f in frames:
        scene.frame_set(f)
        pelvis_mats.append(pb_pel.matrix.copy())
    start = pelvis_mats[0].to_translation()
    for f, pm in zip(frames, pelvis_mats, strict=False):
        scene.frame_set(f)
        t = pm.to_translation()
        m = pb_root.bone.matrix_local.copy()
        m.translation = Vector((t.x - start.x, t.y - start.y, 0.0)) + pb_root.bone.matrix_local.translation
        pb_root.matrix = m
        bpy.context.view_layer.update()
        pb_root.keyframe_insert("location", frame=f)
        pb_pel.matrix = pm
        bpy.context.view_layer.update()
        pb_pel.keyframe_insert("location", frame=f)
        pb_pel.keyframe_insert("rotation_quaternion" if pb_pel.rotation_mode == "QUATERNION" else "rotation_euler", frame=f)
    bpy.ops.object.mode_set(mode="OBJECT")
    return True
