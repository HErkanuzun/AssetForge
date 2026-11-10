# SPDX-License-Identifier: AGPL-3.0-only
# AssetForge — Montaj ve hareket rigi (Blender, arka planda).
#
#   blender -b --factory-startup -P forge_assembly.py -- analyze --in model.glb --out DIR [--front -Y]
#   blender -b --factory-startup -P forge_assembly.py -- build   --in model.glb --plan plan.json --out DIR --name ARA001
#
# analyze: modeli normal uzaya getirir (metre, +X ileri, +Z yukarı, +Y sol, taban ortası 0) ve ölçü ızgaralı
#          yan / üst / ön / perspektif görüntüler, ayrık parça listesi ve zemine değen noktalar çıkarır.
# build:   plana göre hareketli parçaları keser ya da ayrı dosyadan yerleştirir, her parçaya kemik (pivot) verir,
#          efekt bağlantı kemiklerini (fx_*), hasar şekil anahtarlarını (dmg_*) ve hasar maskesini (vertex color R)
#          ekler, hareket kliplerini çıkarır. Çıktı: SK_<ad>.fbx, A_<ad>_<klip>.fbx, assembly.json, renkli kontrol render'ları.
#
# Plan biçimi (koordinatlar normal uzayda, metre):
# {
#   "front": "-Y",                     # ham modelde önün baktığı eksen (analyze ile aynı olmalı)
#   "size": {"length": 4.2},           # isteğe bağlı: length|width|height ya da max
#   "parts": [
#     {"name": "wheel_fl", "role": "wheel",
#      "select": {"cylinder": {"center": [1.3, 0.8, 0.33], "radius": 0.34, "half_width": 0.14, "axis": "Y"}}
#             | {"box": {"min": [..], "max": [..]}} | {"objects": ["Wheel_FL"]} | {"islands": [3, 4]},
#      "replace_with": {"file": "wheel.glb", "mirror": false},     # isteğe bağlı: seçilen yeri silip bu modeli oturtur
#      "file": "door.glb", "place": {"center": [..], "size": [..], "rotation_deg": [0,0,0]},  # ya da seçim yerine dosya
#      "pivot": [1.3, 0.8, 0.33], "parent": "root",
#      "motion": {"type": "rotate", "axis": "Y", "min": -360, "max": 360}}
#   ],
#   "sockets": [{"name": "fx_exhaust", "location": [-2.1, 0.4, 0.3], "direction": [-1, 0, 0], "parent": "root"}],
#   "damage": [{"name": "front", "center": [2.1, 0, 0.5], "radius": 0.7, "depth": 0.1}],
#   "clips": [{"name": "door_fl_open", "seconds": 1.0, "loop": false,
#              "tracks": [{"part": "door_fl", "keys": [[0, 0], [0.8, 70], [1.0, 68]]}]}],
#   "sounds": [{"clip": "door_fl_open", "time": 0.0, "kit_role": "door_open"}]
# }

import argparse
import json
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector


def log(msg):
    print("[FORGE] " + str(msg), flush=True)


argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("cmd", choices=["analyze", "build"])
ap.add_argument("--in", dest="inp", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--plan", default="")
ap.add_argument("--name", default="Asset")
ap.add_argument("--front", default="")
args = ap.parse_args(argv)
os.makedirs(args.out, exist_ok=True)

# Yazılar kameraya dönük olsun: yan kamera +Y'de, ön kamera +X'te, üst kamera +Z'de
TEXT_ROT = {"XZ": (math.radians(90), 0, math.radians(180)), "YZ": (math.radians(90), 0, math.radians(90)), "XY": (0, 0, 0)}
FRONT_ROT = {"-Y": 90, "+Y": -90, "+X": 0, "-X": 180}  # Z etrafında: ön → +X

# ----------------------------------------------------------------------------- yardımcılar


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_any(path):
    before = set(bpy.data.objects)
    ext = os.path.splitext(path)[1].lower()
    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=path)
    else:
        raise SystemExit("Desteklenmeyen format: " + ext)
    return [o for o in bpy.data.objects if o not in before]


def select_only(objs, active=None):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or (objs[0] if objs else None)


def flatten(objs):
    """Parent'ları çöz, boşları sil, dönüşümleri uygula → yalnızca mesh objeleri"""
    meshes = [o for o in objs if o.type == "MESH"]
    for o in meshes:
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
    for o in [o for o in objs if o.type in ("EMPTY", "ARMATURE", "CAMERA", "LIGHT")]:
        bpy.data.objects.remove(o, do_unlink=True)
    if meshes:
        select_only(meshes)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return meshes


def bbox(objs):
    bpy.context.view_layer.update()
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            mn = Vector(map(min, mn, w))
            mx = Vector(map(max, mx, w))
    return mn, mx


def transform_all(objs, m):
    for o in objs:
        o.data.transform(m)
        o.data.update()


def normalize(meshes, front, size):
    """Ön → +X, taban ortası → orijin, istenirse boyuta ölçekle"""
    rot = FRONT_ROT.get(front or "-Y", 90)
    transform_all(meshes, Matrix.Rotation(math.radians(rot), 4, "Z"))
    mn, mx = bbox(meshes)
    dims = mx - mn
    s = 1.0
    if size:
        for key, idx in (("length", 0), ("width", 1), ("height", 2)):
            if size.get(key):
                s = float(size[key]) / max(dims[idx], 1e-6)
                break
        else:
            if size.get("max"):
                s = float(size["max"]) / max(max(dims), 1e-6)
    c = (mn + mx) / 2
    transform_all(meshes, Matrix.Scale(s, 4) @ Matrix.Translation(Vector((-c.x, -c.y, -mn.z))))
    return s


def tri_count(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


def r3(v):
    return [round(float(x), 3) for x in v]


# ----------------------------------------------------------------------------- render


def setup_render(res=900):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.show_cavity = True
    scene.render.resolution_x = res
    scene.render.resolution_y = res
    scene.render.film_transparent = False
    world = bpy.data.worlds.get("ForgeWorld") or bpy.data.worlds.new("ForgeWorld")
    world.color = (0.9, 0.9, 0.92)
    scene.world = world
    cam = bpy.data.objects.get("ForgeCam")
    if not cam:
        cam = bpy.data.objects.new("ForgeCam", bpy.data.cameras.new("ForgeCam"))
        scene.collection.objects.link(cam)
    scene.camera = cam
    return scene, cam


def flat_mat(name, rgb):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = (rgb[0], rgb[1], rgb[2], 1)
    return m


def add_guides(mn, mx, plane):
    """Ölçü ızgarası: 0.25 m çizgi, 0.5 m'de etiket. plane: 'XZ' (yan), 'XY' (üst), 'YZ' (ön)"""
    objs = []
    span = max(mx - mn) + 1.0
    step = 0.25
    grid = flat_mat("ForgeGrid", (0.55, 0.6, 0.7))
    major = flat_mat("ForgeGridMajor", (0.2, 0.3, 0.55))
    text_m = flat_mat("ForgeText", (0.05, 0.05, 0.1))
    a, b = {"XZ": (0, 2), "XY": (0, 1), "YZ": (1, 2)}[plane]
    depth_axis = 3 - a - b
    far = (mn[depth_axis] - 2.0) if plane != "XY" else (mn[depth_axis] - 0.5)
    lo = [math.floor((mn[i] - 0.5) / step) * step for i in range(3)]
    hi = [math.ceil((mx[i] + 0.5) / step) * step for i in range(3)]

    def line(p0, p1, mat, w):
        mesh = bpy.data.meshes.new("g")
        d = (p1 - p0)
        n = Vector((0, 0, 0))
        n[depth_axis] = 1
        side = d.cross(n).normalized() * w
        mesh.from_pydata([p0 - side, p1 - side, p1 + side, p0 + side], [], [(0, 1, 2, 3)])
        o = bpy.data.objects.new("ForgeGuide", mesh)
        o.data.materials.append(mat)
        bpy.context.scene.collection.objects.link(o)
        objs.append(o)

    def label(txt, pos):
        cu = bpy.data.curves.new("t", "FONT")
        cu.body = txt
        cu.size = span * 0.022
        o = bpy.data.objects.new("ForgeGuide", cu)
        o.location = pos
        o.rotation_euler = TEXT_ROT[plane]
        o.data.materials.append(text_m)
        bpy.context.scene.collection.objects.link(o)
        objs.append(o)

    for axis, other in ((a, b), (b, a)):
        v = lo[axis]
        while v <= hi[axis] + 1e-6:
            p0 = Vector((0, 0, 0))
            p1 = Vector((0, 0, 0))
            p0[axis] = p1[axis] = v
            p0[other] = lo[other]
            p1[other] = hi[other]
            p0[depth_axis] = p1[depth_axis] = far
            is_major = abs(v / 0.5 - round(v / 0.5)) < 1e-6
            line(p0, p1, major if is_major else grid, span * (0.0016 if is_major else 0.0008))
            if is_major:
                lp = p0.copy()
                lp[other] = lo[other] + step * 0.2
                lp[axis] = v + step * 0.05
                lp[depth_axis] = far + 0.01
                label("%g" % round(v, 2), lp)
            v += step
    tag = bpy.data.curves.new("t", "FONT")
    tag.body = {"XZ": "<- FRONT (+X)   up: +Z   (m)", "XY": "FRONT (+X) ->   up: LEFT (+Y)   (m)", "YZ": "LEFT (+Y) ->   up: +Z   (m)"}[plane]
    to = bpy.data.objects.new("ForgeGuide", tag)
    tag.size = span * 0.03
    to.location = Vector((0, 0, 0))
    to.location[a] = lo[a] + step
    to.location[b] = hi[b] - step * 1.5
    to.location[depth_axis] = far + 0.01
    to.rotation_euler = TEXT_ROT[plane]
    if plane == "XZ":  # yazı -X yönüne akar; sol kenardan başlat
        to.location[a] = hi[a] - step
    tag.materials.append(text_m)
    bpy.context.scene.collection.objects.link(to)
    objs.append(to)
    return objs


def clear_guides():
    for o in [o for o in bpy.data.objects if o.name.startswith("ForgeGuide") or o.name.startswith("ForgeMark")]:
        bpy.data.objects.remove(o, do_unlink=True)


def shoot(cam, scene, path, view, mn, mx, guides=True):
    c = (mn + mx) / 2
    size = max(mx - mn)
    clear_guides()
    data = cam.data
    data.clip_end = size * 100
    if view == "persp":
        data.type = "PERSP"
        data.lens = 50
        d = Vector((1.0, -1.25, 0.75)).normalized()
        cam.location = c + d * size * 2.3
        cam.rotation_euler = (c - cam.location).to_track_quat("-Z", "Y").to_euler()
    else:
        data.type = "ORTHO"
        data.ortho_scale = size * 1.25 + 0.6
        if view == "side":  # sol yandan (+Y'den -Y'ye bakar)
            cam.location = Vector((c.x, mx.y + size * 3, c.z))
            cam.rotation_euler = (math.radians(90), 0, math.radians(180))
            plane = "XZ"
        elif view == "top":
            cam.location = Vector((c.x, c.y, mx.z + size * 3))
            cam.rotation_euler = (0, 0, 0)
            plane = "XY"
        else:  # front: önden (+X'ten -X'e bakar)
            cam.location = Vector((mx.x + size * 3, c.y, c.z))
            cam.rotation_euler = (math.radians(90), 0, math.radians(90))
            plane = "YZ"
        if guides:
            add_guides(mn, mx, plane)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    clear_guides()
    return path


# ----------------------------------------------------------------------------- analyze


def islands(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    seen = set()
    out = []
    for f in bm.faces:
        if f.index in seen:
            continue
        stack = [f]
        group = []
        seen.add(f.index)
        while stack:
            cur = stack.pop()
            group.append(cur.index)
            for e in cur.edges:
                for nf in e.link_faces:
                    if nf.index not in seen:
                        seen.add(nf.index)
                        stack.append(nf)
        vs = {v.index for i in group for v in bm.faces[i].verts}
        out.append((group, vs))
    bm.verts.ensure_lookup_table()
    res = []
    for faces, vs in out:
        pts = [obj.matrix_world @ bm.verts[i].co for i in vs]
        mn = Vector(map(min, *pts)) if len(pts) > 1 else pts[0]
        mx = Vector(map(max, *pts)) if len(pts) > 1 else pts[0]
        res.append({"faces": faces, "min": mn, "max": mx})
    bm.free()
    return res


def ground_contacts(obj, mn, mx):
    h = mx.z - mn.z
    pts = [obj.matrix_world @ v.co for v in obj.data.vertices]
    low = [p for p in pts if p.z < mn.z + max(0.02, h * 0.03)]
    if not low:
        return []
    cx = sum(p.x for p in low) / len(low)
    groups = {}
    for p in low:
        key = ("front" if p.x > cx else "rear") + "_" + ("left" if p.y > 0 else "right")
        groups.setdefault(key, []).append(p)
    out = []
    for k, g in sorted(groups.items()):
        gx = [p.x for p in g]
        gy = [p.y for p in g]
        out.append({"quadrant": k, "x": round((min(gx) + max(gx)) / 2, 3), "y": round((min(gy) + max(gy)) / 2, 3),
                    "y_range": [round(min(gy), 3), round(max(gy), 3)], "x_range": [round(min(gx), 3), round(max(gx), 3)], "points": len(g)})
    return out


def cmd_analyze():
    reset()
    objs = import_any(args.inp)
    meshes = flatten(objs)
    if not meshes:
        raise SystemExit("Modelde mesh yok")
    names = [o.name for o in meshes]
    normalize(meshes, args.front, None)
    mn, mx = bbox(meshes)
    select_only(meshes)
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    isl = islands(obj)
    isl.sort(key=lambda i: -len(i["faces"]))
    scene, cam = setup_render()
    scene.display.shading.color_type = "TEXTURE"
    views = {}
    for v in ("persp", "side", "top", "front"):
        views[v] = shoot(cam, scene, os.path.join(args.out, "analyze_%s.png" % v), v, mn, mx)
    info = {
        "space": "meters, +X forward, +Y left, +Z up, origin = bottom centre",
        "front_assumed": args.front or "-Y",
        "dims": r3(mx - mn),
        "min": r3(mn),
        "max": r3(mx),
        "tris": tri_count(obj),
        "source_objects": names,
        "islands": [
            {"index": i, "faces": len(s["faces"]), "min": r3(s["min"]), "max": r3(s["max"]), "center": r3((s["min"] + s["max"]) / 2)}
            for i, s in enumerate(isl[:40])
        ],
        "island_count": len(isl),
        "ground_contacts": ground_contacts(obj, mn, mx),
        "renders": views,
    }
    with open(os.path.join(args.out, "analysis.json"), "w", encoding="utf-8") as f:
        json.dump(info, f, indent=1, ensure_ascii=False)
    log("analiz: %s m, %d üçgen, %d ayrık parça" % (info["dims"], info["tris"], len(isl)))


# ----------------------------------------------------------------------------- build

COLORS = [(0.9, 0.25, 0.2), (0.2, 0.6, 0.95), (0.25, 0.8, 0.35), (0.95, 0.75, 0.15), (0.7, 0.35, 0.9), (0.1, 0.8, 0.8),
          (0.95, 0.45, 0.7), (0.6, 0.45, 0.25), (0.5, 0.9, 0.2), (0.3, 0.3, 0.95)]


def face_center(obj, p):
    return obj.matrix_world @ p.center


def in_select(sel, p, isl_of_face=None, face_index=None):
    if "cylinder" in sel:
        c = sel["cylinder"]
        ctr = Vector(c["center"])
        ax = {"X": Vector((1, 0, 0)), "Y": Vector((0, 1, 0)), "Z": Vector((0, 0, 1))}[c.get("axis", "Y").upper()]
        d = p - ctr
        along = d.dot(ax)
        radial = (d - ax * along).length
        return abs(along) <= c["half_width"] and radial <= c["radius"]
    if "box" in sel:
        b = sel["box"]
        return all(b["min"][i] <= p[i] <= b["max"][i] for i in range(3))
    if "sphere" in sel:
        s = sel["sphere"]
        return (p - Vector(s["center"])).length <= s["radius"]
    return False


def separate_faces(obj, face_ids, name):
    """Seçilen yüzleri yeni objeye ayırır; yeni objeyi döndürür"""
    if not face_ids:
        return None
    select_only([obj])
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.object.mode_set(mode="OBJECT")
    ids = set(face_ids)
    for p in obj.data.polygons:
        p.select = p.index in ids
    before = set(bpy.data.objects)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.separate(type="SELECTED")
    bpy.ops.object.mode_set(mode="OBJECT")
    new = [o for o in bpy.data.objects if o not in before]
    if not new:
        return None
    new[0].name = name
    return new[0]


def place_file(path, place, mirror=False):
    objs = import_any(path)
    meshes = flatten(objs)
    if not meshes:
        raise SystemExit("Parça dosyasında mesh yok: " + path)
    select_only(meshes)
    if len(meshes) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    rot = place.get("rotation_deg", [0, 0, 0])
    o.data.transform(Matrix.Rotation(math.radians(rot[2]), 4, "Z") @ Matrix.Rotation(math.radians(rot[1]), 4, "Y") @ Matrix.Rotation(math.radians(rot[0]), 4, "X"))
    mn, mx = bbox([o])
    dims = mx - mn
    if place.get("size"):
        tgt = Vector(place["size"])
        s = min(tgt[i] / max(dims[i], 1e-6) for i in range(3) if tgt[i] > 0)
    else:
        s = 1.0
    c = (mn + mx) / 2
    o.data.transform(Matrix.Translation(Vector(place["center"])) @ Matrix.Scale(s, 4) @ Matrix.Translation(-c))
    if mirror:
        ctr = Vector(place["center"])
        o.data.transform(Matrix.Translation(ctr) @ Matrix.Scale(-1, 4, Vector((0, 1, 0))) @ Matrix.Translation(-ctr))
        o.data.flip_normals()
    o.data.update()
    return o


def cmd_build():
    with open(args.plan, encoding="utf-8") as f:
        plan = json.load(f)
    # Aynı klasöre yeniden kurulumda eski çıktı kalmasın (silinen klipler vb.)
    for fn in os.listdir(args.out):
        if fn == "assembly.json" or (fn.startswith(("SK_", "A_", "check_")) and fn.endswith((".fbx", ".png"))):
            os.remove(os.path.join(args.out, fn))
    reset()
    objs = import_any(args.inp)
    meshes = flatten(objs)
    if not meshes:
        raise SystemExit("Modelde mesh yok")
    by_name = {o.name: o for o in meshes}
    scale = normalize(meshes, plan.get("front", ""), plan.get("size"))
    warnings = []
    report_parts = []

    # Kaynak objelerden seçilen parçalar ayrı kalır; geri kalanı gövde olur
    taken = {}
    for part in plan.get("parts", []):
        sel = part.get("select") or {}
        if "objects" in sel:
            got = [by_name[n] for n in sel["objects"] if n in by_name]
            missing = [n for n in sel["objects"] if n not in by_name]
            if missing:
                warnings.append("%s: obje bulunamadı %s" % (part["name"], missing))
            if got:
                taken[part["name"]] = got
    rest = [o for o in meshes if all(o not in g for g in taken.values())]
    select_only(rest)
    if len(rest) > 1:
        bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    body.name = "root"
    island_faces = None

    part_objs = {}
    for part in plan.get("parts", []):
        name = part["name"]
        sel = part.get("select") or {}
        o = None
        if name in taken:
            g = taken[name]
            select_only(g)
            if len(g) > 1:
                bpy.ops.object.join()
            o = bpy.context.view_layer.objects.active
            o.name = name
        elif "islands" in sel:
            if island_faces is None:
                isl = islands(body)
                isl.sort(key=lambda s: -len(s["faces"]))
                island_faces = [s["faces"] for s in isl]
            ids = [f for k in sel["islands"] if 0 <= k < len(island_faces) for f in island_faces[k]]
            o = separate_faces(body, ids, name)
            island_faces = None  # gövde değişti; indeksler bir sonraki ayrımda yeniden hesaplanır
        elif any(k in sel for k in ("cylinder", "box", "sphere")):
            ids = [p.index for p in body.data.polygons if in_select(sel, face_center(body, p))]
            if part.get("replace_with"):
                if ids:
                    bpy.data.objects.remove(separate_faces(body, ids, name + "_cut"), do_unlink=True)
                rw = part["replace_with"]
                region = sel.get("cylinder") or {}
                if "cylinder" in sel:
                    ax = region.get("axis", "Y").upper()
                    d = region["radius"] * 2
                    w = region["half_width"] * 2
                    size = [d, d, d]
                    size["XYZ".index(ax)] = w
                    ctr = region["center"]
                elif "box" in sel:
                    size = [sel["box"]["max"][k] - sel["box"]["min"][k] for k in range(3)]
                    ctr = [(sel["box"]["max"][k] + sel["box"]["min"][k]) / 2 for k in range(3)]
                else:
                    size = [sel["sphere"]["radius"] * 2] * 3
                    ctr = sel["sphere"]["center"]
                o = place_file(rw["file"], {"center": ctr, "size": size, "rotation_deg": rw.get("rotation_deg", [0, 0, 0])}, rw.get("mirror", False))
                o.name = name
            else:
                o = separate_faces(body, ids, name)
        elif part.get("file"):
            o = place_file(part["file"], part.get("place") or {"center": part.get("pivot", [0, 0, 0])}, part.get("mirror", False))
            o.name = name
        if not o or not o.data.polygons:
            warnings.append("%s: seçim boş — bölge modele denk gelmiyor" % name)
            continue
        part_objs[name] = o
        mn, mx = bbox([o])
        pivot = Vector(part["pivot"]) if part.get("pivot") else (Vector(sel["cylinder"]["center"]) if "cylinder" in sel else (mn + mx) / 2)
        report_parts.append({"name": name, "role": part.get("role", ""), "tris": tri_count(o), "min": r3(mn), "max": r3(mx), "pivot": r3(pivot),
                             "parent": part.get("parent", "root"), "motion": part.get("motion")})
        log("parça %s: %d üçgen" % (name, tri_count(o)))

    # Kontrol render'ı: her parça ayrı renk, pivotlar küçük küre
    mn, mx = bbox([body] + list(part_objs.values()))
    scene, cam = setup_render()
    scene.display.shading.color_type = "MATERIAL"
    saved = {}
    gray = flat_mat("ForgeBody", (0.72, 0.72, 0.74))
    for o in [body] + list(part_objs.values()):
        saved[o.name] = [s.material for s in o.material_slots]
    for o, m in [(body, gray)] + [(o, flat_mat("ForgePart%d" % i, COLORS[i % len(COLORS)])) for i, o in enumerate(part_objs.values())]:
        o.data.materials.clear()
        o.data.materials.append(m)
    marks = []
    for rp in report_parts:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=max(mx - mn) * 0.012, location=rp["pivot"])
        mk = bpy.context.active_object
        mk.name = "ForgePivot"
        mk.data.materials.append(flat_mat("ForgeMark", (0.05, 0.05, 0.05)))
        marks.append(mk)
    checks = {}
    for v in ("persp", "side", "top", "front"):
        checks[v] = shoot(cam, scene, os.path.join(args.out, "check_%s.png" % v), v, mn, mx, guides=(v != "persp"))
    for mk in marks:
        bpy.data.objects.remove(mk, do_unlink=True)
    for o in [body] + list(part_objs.values()):
        o.data.materials.clear()
        for m in saved[o.name]:
            o.data.materials.append(m)

    # İskelet: root + parça kemikleri + fx kemikleri
    arm_data = bpy.data.armatures.new("Armature")
    arm = bpy.data.objects.new("Armature", arm_data)
    bpy.context.scene.collection.objects.link(arm)
    select_only([arm])
    bpy.ops.object.mode_set(mode="EDIT")
    size = max(mx - mn)
    eb = arm_data.edit_bones
    root = eb.new("root")
    root.head = (0, 0, 0)
    root.tail = (0, 0, size * 0.1)
    bone_len = size * 0.06
    for rp in report_parts:
        b = eb.new(rp["name"])
        b.head = Vector(rp["pivot"])
        ax = ((rp.get("motion") or {}).get("axis") or "Z").upper()
        # Kemik Y ekseni (Blender'da kemiğin boyu) hareket ekseni olsun → anim tek eksende okunur
        b.tail = b.head + {"X": Vector((bone_len, 0, 0)), "Y": Vector((0, bone_len, 0)), "Z": Vector((0, 0, bone_len))}[ax]
        b.roll = 0
    for rp in report_parts:
        eb[rp["name"]].parent = eb.get(rp["parent"]) or root
    sockets = []
    for s in plan.get("sockets", []):
        b = eb.new(s["name"])
        b.head = Vector(s["location"])
        d = Vector(s.get("direction", [0, 0, 1])).normalized()
        b.tail = b.head + d * bone_len * 0.6
        b.parent = eb.get(s.get("parent", "root")) or root
        sockets.append({"name": s["name"], "location": r3(s["location"]), "direction": r3(d), "parent": s.get("parent", "root"), "use": s.get("use", "")})
    bpy.ops.object.mode_set(mode="OBJECT")

    # Ağırlıklar: her parça kendi kemiğine %100, gövde root'a
    for o, bone in [(body, "root")] + [(o, n) for n, o in part_objs.items()]:
        vg = o.vertex_groups.new(name=bone)
        vg.add(list(range(len(o.data.vertices))), 1.0, "REPLACE")
    select_only([body] + list(part_objs.values()), body)
    if part_objs:
        bpy.ops.object.join()
    mesh = bpy.context.view_layer.objects.active
    mesh.name = "SK_" + args.name
    mesh.data.name = "SK_" + args.name
    mesh.parent = arm
    mod = mesh.modifiers.new("Armature", "ARMATURE")
    mod.object = arm

    # Hasar maskesi (vertex color R) ve ezilme şekilleri (dmg_*). Tekerlekler ezilmez.
    rigid = {rp["name"] for rp in report_parts if rp["role"] in ("wheel", "tire", "rim", "glass_free")}
    rigid_idx = set()
    for g in mesh.vertex_groups:
        if g.name in rigid:
            gi = g.index
            for v in mesh.data.vertices:
                if any(e.group == gi and e.weight > 0.5 for e in v.groups):
                    rigid_idx.add(v.index)
    zones = plan.get("damage", [])
    mask = [0.0] * len(mesh.data.vertices)
    center = (mn + mx) / 2
    if zones:
        mesh.shape_key_add(name="Basis", from_mix=False)
        rnd = random.Random(7)
        for z in zones:
            zc = Vector(z["center"])
            rad = float(z["radius"])
            depth = float(z.get("depth", 0.08)) * (1 if z.get("depth") is None else 1)
            key = mesh.shape_key_add(name="dmg_" + z["name"], from_mix=False)
            inward = (Vector((center.x, center.y, zc.z)) - zc)
            inward = inward.normalized() if inward.length > 1e-6 else Vector((0, 0, -1))
            moved = 0
            for v in mesh.data.vertices:
                if v.index in rigid_idx:
                    continue
                dist = (v.co - zc).length
                if dist >= rad:
                    continue
                f = 1 - dist / rad
                f = f * f * (3 - 2 * f)  # yumuşak düşüş
                mask[v.index] = max(mask[v.index], f)
                jitter = 0.75 + 0.5 * rnd.random()
                key.data[v.index].co = v.co + inward * depth * f * jitter
                moved += 1
            if not moved:
                warnings.append("hasar bölgesi %s modele değmiyor" % z["name"])
            log("hasar %s: %d köşe" % (z["name"], moved))
    if "Damage" in mesh.data.color_attributes:
        mesh.data.color_attributes.remove(mesh.data.color_attributes["Damage"])
    col = mesh.data.color_attributes.new("Damage", "FLOAT_COLOR", "POINT")
    for i, d in enumerate(col.data):
        d.color = (mask[i], 0.0, 0.0, 1.0)
    mesh.data.color_attributes.active_color = col
    mesh.data.color_attributes.render_color_index = list(mesh.data.color_attributes).index(col)

    # Materyal adları (Unreal'a M_ adıyla)
    for k, s in enumerate(mesh.material_slots):
        if s.material and not s.material.name.startswith("Forge"):
            s.material.name = "M_%s%s" % (args.name, "" if len(mesh.material_slots) == 1 else "_%d" % (k + 1))

    # Varsayılan eksenler: Blender +X → Unreal +X (ileri), +Z → +Z; Unreal Y'yi kendisi çevirir
    fbx_common = dict(add_leaf_bones=False, mesh_smooth_type="FACE", apply_scale_options="FBX_SCALE_UNITS", use_armature_deform_only=False)
    sk_path = os.path.join(args.out, "SK_%s.fbx" % args.name)
    select_only([arm, mesh], arm)
    bpy.ops.export_scene.fbx(filepath=sk_path, use_selection=True, path_mode="COPY", embed_textures=True, bake_anim=False, colors_type="LINEAR", **fbx_common)
    log("export: " + os.path.basename(sk_path))

    # Hareket klipleri: her klip ayrı FBX (yalnızca iskelet)
    clips_out = []
    fps = 30
    bpy.context.scene.render.fps = fps
    for clip in plan.get("clips", []):
        act = bpy.data.actions.new(clip["name"])
        arm.animation_data_create()
        arm.animation_data.action = act
        for pb in arm.pose.bones:
            pb.rotation_mode = "XYZ"
            pb.location = (0, 0, 0)
            pb.rotation_euler = (0, 0, 0)
        frames = max(1, int(round(float(clip.get("seconds", 1.0)) * fps)))
        for tr in clip.get("tracks", []):
            pb = arm.pose.bones.get(tr["part"])
            if not pb:
                warnings.append("klip %s: parça yok %s" % (clip["name"], tr["part"]))
                continue
            mot = next((rp.get("motion") for rp in report_parts if rp["name"] == tr["part"]), None) or {"type": "rotate"}
            for t, val in tr["keys"]:
                fr = 1 + int(round(float(t) * fps))
                if mot.get("type") == "translate":
                    pb.location = (0, float(val), 0)  # kemiğin Y'si = hareket ekseni
                    pb.keyframe_insert("location", frame=fr)
                else:
                    pb.rotation_euler = (0, math.radians(float(val)), 0)
                    pb.keyframe_insert("rotation_euler", frame=fr)
        bpy.context.scene.frame_start = 1
        bpy.context.scene.frame_end = frames + 1
        a_path = os.path.join(args.out, "A_%s_%s.fbx" % (args.name, clip["name"]))
        select_only([arm], arm)
        bpy.ops.export_scene.fbx(filepath=a_path, use_selection=True, bake_anim=True, bake_anim_use_all_actions=False, bake_anim_use_nla_strips=False,
                                 bake_anim_force_startend_keying=True, bake_anim_simplify_factor=0.0, **fbx_common)
        clips_out.append({"name": clip["name"], "file": a_path, "seconds": float(clip.get("seconds", 1.0)), "loop": bool(clip.get("loop", False))})
        log("klip: %s (%d kare)" % (clip["name"], frames))
        arm.animation_data.action = None

    result = {
        "name": args.name,
        "mesh": sk_path,
        "scale": round(scale, 4),
        "dims": r3(mx - mn),
        "tris": tri_count(mesh),
        "bones": ["root"] + [rp["name"] for rp in report_parts] + [s["name"] for s in sockets],
        "parts": report_parts,
        "sockets": sockets,
        "damage": [{"name": "dmg_" + z["name"], "center": r3(z["center"]), "radius": z["radius"]} for z in zones],
        "damage_mask": "vertex color R (0 = sağlam, 1 = ezilen bölge)",
        "clips": clips_out,
        "sounds": plan.get("sounds", []),
        "kind": plan.get("kind", ""),
        "checks": checks,
        "warnings": warnings,
    }
    with open(os.path.join(args.out, "assembly.json"), "w", encoding="utf-8") as f:
        json.dump(result, f, indent=1, ensure_ascii=False)
    log("bitti: %d parça, %d soket, %d hasar, %d klip%s" % (len(report_parts), len(sockets), len(zones), len(clips_out),
                                                          (" · UYARI: " + "; ".join(warnings)) if warnings else ""))


if args.cmd == "analyze":
    cmd_analyze()
else:
    if not args.plan:
        raise SystemExit("--plan gerekli")
    cmd_build()
