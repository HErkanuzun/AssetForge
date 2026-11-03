# SPDX-License-Identifier: AGPL-3.0-only
# AssetForge — Blender arka plan işleme betiği.
# Kullanım: blender -b --factory-startup -P blender_process.py -- --in model.glb --out SM_X.fbx [seçenekler]
# Adımlar: içe aktar → (birleştir) → boyuta ölçekle → bütçeye indir → pivot → isimlendir → export → önizleme render → istatistik JSON

import argparse
import json
import os
import sys

import bpy
from mathutils import Vector


def log(msg):
    print("[FORGE] " + str(msg), flush=True)


argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--in", dest="inp", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--name", required=True)
ap.add_argument("--format", default="fbx")
ap.add_argument("--target-tris", type=int, default=0)
ap.add_argument("--target-size", default="")  # "4,4,0.3" metre
ap.add_argument("--origin", default="bottom")
ap.add_argument("--preview-dir", default="")
ap.add_argument("--stats", required=True)
ap.add_argument("--skeleton", default="none")  # none | manny
args = ap.parse_args(argv)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

ext = os.path.splitext(args.inp)[1].lower()
if ext in (".glb", ".gltf"):
    bpy.ops.import_scene.gltf(filepath=args.inp)
elif ext == ".fbx":
    bpy.ops.import_scene.fbx(filepath=args.inp)
elif ext == ".obj":
    bpy.ops.wm.obj_import(filepath=args.inp)
else:
    raise SystemExit("Desteklenmeyen format: " + ext)
log("içe aktarıldı: " + os.path.basename(args.inp))

meshes = [o for o in scene.objects if o.type == "MESH"]
armatures = [o for o in scene.objects if o.type == "ARMATURE"]
rigged = len(armatures) > 0
if not meshes:
    raise SystemExit("Modelde mesh yok")


def select_only(objs, active=None):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or objs[0]


def tri_count(objs):
    total = 0
    for o in objs:
        for p in o.data.polygons:
            total += len(p.vertices) - 2
    return total


def world_bbox(objs):
    bpy.context.view_layer.update()  # konum/ölçek değişikliğinden sonra matrix_world tazelensin
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            mn = Vector((min(mn.x, w.x), min(mn.y, w.y), min(mn.z, w.z)))
            mx = Vector((max(mx.x, w.x), max(mx.y, w.y), max(mx.z, w.z)))
    return mn, mx


original_tris = tri_count(meshes)

# Riglenmemiş modelleri tek objede birleştir, dönüşümleri uygula
if not rigged:
    # Boş parent'lardan kurtul (glTF genelde bir kök empty getirir)
    for o in meshes:
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
    for o in [o for o in scene.objects if o.type == "EMPTY"]:
        bpy.data.objects.remove(o, do_unlink=True)
    if len(meshes) > 1:
        select_only(meshes)
        bpy.ops.object.join()
        meshes = [bpy.context.view_layer.objects.active]
    select_only(meshes)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

obj = meshes[0]

skeleton_report = None
if rigged and args.skeleton == "manny":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import forge_skeleton

    skeleton_report = forge_skeleton.to_manny(armatures[0])
    log("iskelet: %s → Manny (%d kemik yeniden adlandı, eksik: %s)" % (
        skeleton_report["profile"], skeleton_report["renamed"], ", ".join(skeleton_report["missing"]) or "yok"))

# Boyuta ölçekle (en büyük ölçü hedefin en büyük ölçüsüne eşitlenir)
scaled = 1.0
if args.target_size:
    try:
        target = [float(x) for x in args.target_size.split(",") if x]
    except ValueError:
        target = []
    if target:
        mn, mx = world_bbox(meshes)
        cur = max(mx - mn)
        if cur > 1e-6:
            scaled = max(target) / cur
            if abs(scaled - 1.0) > 0.01:
                if rigged:
                    for a in armatures:
                        a.scale = a.scale * scaled
                    select_only(armatures + meshes, armatures[0])
                    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
                else:
                    obj.scale = obj.scale * scaled
                    select_only([obj])
                    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
                log("ölçek x%.3f (hedef %.2f m)" % (scaled, max(target)))

# Bütçeye indir
decimated = False
tris = tri_count(meshes)
if args.target_tris > 0 and tris > args.target_tris * 1.05:
    # Çok yüksek oranlarda tek geçiş hedefe ulaşamaz; birkaç geçişte yaklaş.
    # Rigli meshlerde decimate yığının başına alınır; collapse vertex ağırlıklarını korur.
    for _ in range(5):
        cur = tri_count(meshes)
        if cur <= args.target_tris * 1.05:
            break
        ratio = max(0.001, args.target_tris / cur)
        for m in meshes:
            mod = m.modifiers.new("ForgeDecimate", "DECIMATE")
            mod.ratio = ratio
            mod.use_collapse_triangulate = True
            select_only([m])
            if len(m.modifiers) > 1:
                bpy.ops.object.modifier_move_to_index(modifier=mod.name, index=0)
            bpy.ops.object.modifier_apply(modifier=mod.name)
    decimated = True
    log("decimate %d → %d üçgen" % (tris, tri_count(meshes)))

# Pivot
if not rigged and args.origin in ("bottom", "center"):
    mn, mx = world_bbox([obj])
    c = (mn + mx) / 2
    pivot = Vector((c.x, c.y, mn.z)) if args.origin == "bottom" else c
    scene.cursor.location = pivot
    select_only([obj])
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    obj.location = (0, 0, 0)

# İsimlendir
if not rigged:
    obj.name = args.name
    obj.data.name = args.name
else:
    # FBX'te "Armature" adlı obje ayrı kök kemik olarak yazılmaz (Unreal'da fazladan kemik oluşmaz)
    armatures[0].name = "Armature"
    for m in meshes:
        if len(meshes) == 1:
            m.name = args.name


# Materyal ve dokuları isimlendirme kuralına göre adlandır (Unreal'a M_ / T_ adlarıyla girsinler)
base = args.name.split("_", 1)[1] if "_" in args.name else args.name
SOCKET_ROLE = {"Base Color": "BaseColor", "Roughness": "Roughness", "Metallic": "Metallic", "Emission Color": "Emissive", "Alpha": "Opacity"}


def image_for(node, depth=0):
    if node.type == "TEX_IMAGE" and node.image:
        return node.image
    if depth > 4:
        return None
    for inp in node.inputs:
        for link in inp.links:
            img = image_for(link.from_node, depth + 1)
            if img:
                return img
    return None


all_mats = []
for o in meshes:
    for s in o.material_slots:
        if s.material and s.material not in all_mats:
            all_mats.append(s.material)
for mi, mat in enumerate(all_mats):
    mat.name = "M_" + base + ("" if len(all_mats) == 1 else "_%d" % (mi + 1))
    if not mat.use_nodes:
        continue
    bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if not bsdf:
        continue
    suffix = "" if len(all_mats) == 1 else "_%d" % (mi + 1)
    roles = {}  # image -> [rol, ...] (glTF'de roughness+metallic tek dokuda olabilir)
    for sock in bsdf.inputs:
        role = SOCKET_ROLE.get(sock.name) or ("Normal" if sock.name == "Normal" else None)
        if not role or not sock.links:
            continue
        img = image_for(sock.links[0].from_node)
        if img:
            roles.setdefault(img, []).append(role)
    for img, rs in roles.items():
        role = "ORM" if {"Roughness", "Metallic"} <= set(rs) else rs[0]
        tname = "T_%s%s_%s" % (base, suffix, role)
        img.name = tname
        if img.packed_file or not img.filepath:
            img.filepath_raw = "//" + tname + ".png"
        log("doku: " + tname)

has_uv = all(len(o.data.uv_layers) > 0 for o in meshes)
mats = set()
for o in meshes:
    for s in o.material_slots:
        if s.material:
            mats.add(s.material.name)
mn, mx = world_bbox(meshes)
dims = [round(mx.x - mn.x, 4), round(mx.y - mn.y, 4), round(mx.z - mn.z, 4)]

# Export
os.makedirs(os.path.dirname(args.out), exist_ok=True)
if args.format == "glb":
    bpy.ops.export_scene.gltf(filepath=args.out, export_format="GLB")
else:
    bpy.ops.export_scene.fbx(
        filepath=args.out,
        path_mode="COPY",
        embed_textures=True,
        add_leaf_bones=False,
        mesh_smooth_type="FACE",
        apply_scale_options="FBX_SCALE_UNITS",
    )
log("export: " + os.path.basename(args.out))

# Önizleme render (kalite kontrol için)
previews = []
if args.preview_dir:
    os.makedirs(args.preview_dir, exist_ok=True)
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "TEXTURE"
    scene.display.shading.show_cavity = True
    scene.render.resolution_x = 768
    scene.render.resolution_y = 768
    scene.render.film_transparent = False
    world = bpy.data.worlds.new("ForgeWorld")
    world.color = (0.55, 0.56, 0.58)
    scene.world = world
    center = (mn + mx) / 2
    radius = max(max(mx - mn), 0.01)
    cam_data = bpy.data.cameras.new("ForgeCam")
    cam_data.lens = 50
    cam_data.clip_end = radius * 100
    cam = bpy.data.objects.new("ForgeCam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    views = {"34": Vector((1.0, -1.2, 0.7)), "front": Vector((0.0, -1.0, 0.15)), "back": Vector((-0.6, 1.0, 0.5))}
    for label, d in views.items():
        d.normalize()
        cam.location = center + d * radius * 2.4
        cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = os.path.join(args.preview_dir, "preview_%s.png" % label)
        bpy.ops.render.render(write_still=True)
        previews.append(scene.render.filepath)
    log("önizleme render: %d görüntü" % len(previews))

stats = {
    "tris": tri_count(meshes),
    "originalTris": original_tris,
    "verts": sum(len(o.data.vertices) for o in meshes),
    "objects": len(meshes),
    "materials": len(mats),
    "hasUV": has_uv,
    "dims": dims,
    "rigged": rigged,
    "decimated": decimated,
    "scaled": scaled,
    "previews": previews,
    "bones": sum(len(a.data.bones) for a in armatures),
    "skeleton": skeleton_report,
}
with open(args.stats, "w", encoding="utf-8") as f:
    json.dump(stats, f)
log("bitti")
