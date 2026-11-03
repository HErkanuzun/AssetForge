# AssetForge — Kimodo (NVIDIA) BVH hareketini Unreal'a hazır FBX animasyonuna çevirir.
# Kullanım: blender -b --factory-startup -P blender_anim.py -- --in clip.bvh --out AS_SOMA_Walk.fbx --stats s.json [--root-motion root|inplace|raw]
# Adımlar: BVH içe aktar (Y-up, cm) → kemikleri Manny adlarına çevir → root motion → küçük proxy mesh → FBX

import argparse
import json
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import forge_skeleton  # noqa: E402


def log(msg):
    print("[FORGE] " + str(msg), flush=True)


argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--in", dest="inp", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--stats", required=True)
ap.add_argument("--root-motion", default="root")  # root | inplace | raw
ap.add_argument("--scale", type=float, default=0.01)  # Kimodo BVH santimetre
args = ap.parse_args(argv)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_anim.bvh(
    filepath=args.inp,
    global_scale=args.scale,
    axis_forward="-Z",
    axis_up="Y",
    rotate_mode="NATIVE",
    use_fps_scale=False,
    update_scene_fps=True,
    update_scene_duration=True,
)
arm = next(o for o in scene.objects if o.type == "ARMATURE")
action = arm.animation_data.action if arm.animation_data else None
f0, f1 = (int(action.frame_range[0]), int(action.frame_range[1])) if action else (1, 1)
fps = scene.render.fps / scene.render.fps_base
# Unreal (Interchange) kesirli fps'i (ör. 30.00003) kabul etmez → tam sayıya sabitle
scene.render.fps = max(1, int(round(fps)))
scene.render.fps_base = 1.0
fps = float(scene.render.fps)
scene.frame_start, scene.frame_end = f0, f1
log("BVH: %d kemik, %d kare, %.1f fps" % (len(arm.data.bones), f1 - f0 + 1, fps))

# Kimodo kökü "Root" → Manny "root"
for b in arm.data.bones:
    if b.name.lower() == "root" and b.name != "root":
        b.name = "root"
report = forge_skeleton.to_manny(arm, add_root=True)
log("iskelet: %s → Manny (%d kemik, eksik: %s)" % (report["profile"], report["renamed"], ", ".join(report["missing"]) or "yok"))

# Pose kemikleri quaternion olsun (Unreal'a temiz eğri)
mode = args.root_motion
if mode == "root":
    ok = forge_skeleton.bake_root_motion(arm, f0, f1)
    log("root motion: " + ("pelvis zemin izdüşümü root kemiğine aktarıldı" if ok else "atlandı (root/pelvis yok)"))
elif mode == "inplace":
    pb = arm.pose.bones.get("pelvis")
    if pb and action:
        bpy.context.view_layer.objects.active = arm
        bpy.ops.object.mode_set(mode="POSE")
        mats = []
        for f in range(f0, f1 + 1):
            scene.frame_set(f)
            mats.append(pb.matrix.copy())
        start = mats[0].to_translation()
        for f, m in zip(range(f0, f1 + 1), mats, strict=False):
            scene.frame_set(f)
            t = m.to_translation()
            m2 = m.copy()
            m2.translation = (start.x, start.y, t.z)
            pb.matrix = m2
            bpy.context.view_layer.update()
            pb.keyframe_insert("location", frame=f)
        bpy.ops.object.mode_set(mode="OBJECT")
        log("yerinde (in-place): yatay yer değiştirme kaldırıldı")

# Unreal iskeletli mesh ister: pelvise bağlı küçük görünmez proxy
bpy.ops.mesh.primitive_cube_add(size=0.02, location=arm.pose.bones["pelvis"].head if "pelvis" in arm.pose.bones else (0, 0, 1))
proxy = bpy.context.object
proxy.name = "SOMA_Proxy"
vg = proxy.vertex_groups.new(name="pelvis" if "pelvis" in arm.data.bones else arm.data.bones[0].name)
vg.add(list(range(len(proxy.data.vertices))), 1.0, "REPLACE")
proxy.parent = arm
mod = proxy.modifiers.new("Armature", "ARMATURE")
mod.object = arm
arm.name = "Armature"

os.makedirs(os.path.dirname(args.out), exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.fbx(
    filepath=args.out,
    object_types={"ARMATURE", "MESH"},
    add_leaf_bones=False,
    bake_anim=True,
    bake_anim_use_all_actions=False,
    bake_anim_use_nla_strips=False,
    bake_anim_force_startend_keying=True,
    bake_anim_simplify_factor=0.0,
    apply_scale_options="FBX_SCALE_UNITS",
)
log("export: " + os.path.basename(args.out))
with open(args.stats, "w", encoding="utf-8") as fh:
    json.dump({"frames": f1 - f0 + 1, "fps": fps, "duration": (f1 - f0 + 1) / fps, "bones": len(arm.data.bones), "skeleton": report, "rootMotion": mode}, fh)
log("bitti")
