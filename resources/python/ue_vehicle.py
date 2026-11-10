# SPDX-License-Identifier: AGPL-3.0-only
# AssetForge — montajı yapılmış (forge_assembly.py) bir aracı/objeyi Unreal'da kurar.
# AssetForge bu dosyanın başına MANIFEST ekler ve iki adımda çalıştırır:
#   step = "import"   : iskeletli mesh (morph target + hasar maskesi), sesler, hareket klipleri
#   step = "assemble" : şablon araç Blueprint'ini kopyalar; mesh, Anim BP, fizik, tekerlekler, kapılar, koltuklar,
#                       farlar, egzoz efekti, motor / korna / kapı sesleri ayarlanır
# Arada fizik asset'i ve araç Anim Blueprint'i MCP araçlarıyla (CreateVehiclePhysicsAsset / CreateVehicleAnimBlueprint) oluşturulur.
#
# MANIFEST = {
#   "step": "import" | "assemble",
#   "dest": "/Game/AssetForge/Vehicles/ARA001", "name": "ARA001",
#   "mesh_fbx": "C:/.../SK_ARA001.fbx",
#   "assembly": {... forge_assembly.py assembly.json ...},
#   "sounds": {"engine": "C:/x.wav" | "/Game/...", "engine_start": ..., "horn": ..., "door_open": ..., "door_close": ..., "trunk_open": ...},
#   "template": "/Game/Vehicles/KirilmaVehicles/Blueprints/BP_KV_SportsCar",
#   "physics_asset": "/Game/.../PA_ARA001", "anim_bp": "/Game/.../ABP_ARA001",
#   "engine_rpm_parameter": "RPMAlpha"
# }

import json
import os

import unreal

M = MANIFEST  # noqa: F821 — AssetForge üstte ekler
asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
eal = unreal.EditorAssetLibrary
out = {"step": M["step"], "imported": [], "notes": [], "errors": []}


def import_task(filename, dest, name, options=None):
    t = unreal.AssetImportTask()
    t.filename = filename
    t.destination_path = dest
    t.destination_name = name
    t.automated = True
    t.replace_existing = True
    t.save = True
    if options is not None:
        t.options = options
    asset_tools.import_asset_tasks([t])
    return list(t.imported_object_paths or [])


def asset_path(dest, name):
    return "%s/%s.%s" % (dest, name, name)


def sound_asset(ref, dest, key):
    """Disk yolu ise içe aktarır, /Game yolu ise yükler"""
    if not ref:
        return None
    if ref.startswith("/"):
        return unreal.load_asset(ref)
    if not os.path.exists(ref):
        out["errors"].append("ses dosyası yok: " + ref)
        return None
    name = "S_%s_%s" % (M["name"], key)
    paths = import_task(ref, dest + "/Audio", name)
    out["imported"] += paths
    return unreal.load_asset(paths[0]) if paths else None


def cm(v):
    """Blender (m, +Y sol) → Unreal (cm, +Y sağ)"""
    return unreal.Vector(v[0] * 100.0, -v[1] * 100.0, v[2] * 100.0)


# ----------------------------------------------------------------------------- import


def step_import():
    dest = M["dest"]
    name = "SK_" + M["name"]
    o = unreal.FbxImportUI()
    o.import_mesh = True
    o.import_as_skeletal = True
    o.import_animations = False
    o.import_materials = True
    o.import_textures = True
    o.mesh_type_to_import = unreal.FBXImportType.FBXIT_SKELETAL_MESH
    o.create_physics_asset = False
    sk = o.skeletal_mesh_import_data
    sk.set_editor_property("import_morph_targets", True)
    sk.set_editor_property("vertex_color_import_option", unreal.VertexColorImportOption.REPLACE)
    out["imported"] += import_task(M["mesh_fbx"], dest, name, o)
    mesh = unreal.load_asset(asset_path(dest, name))
    if not isinstance(mesh, unreal.SkeletalMesh):
        raise RuntimeError("iskeletli mesh içe aktarılamadı")
    out["mesh"] = mesh.get_path_name()
    out["skeleton"] = mesh.get_editor_property("skeleton").get_path_name()
    out["notes"].append("ezilme hedefleri: " + (", ".join(m.get_name() for m in mesh.get_editor_property("morph_targets")) or "yok"))

    # Hareket klipleri (araç kapıları Anim BP'den döner; klipler kapı dışı objeler ve önizleme için)
    skel = mesh.get_editor_property("skeleton")
    for clip in (M.get("assembly") or {}).get("clips", []):
        if not os.path.exists(clip["file"]):
            continue
        a = unreal.FbxImportUI()
        a.import_mesh = False
        a.import_as_skeletal = True
        a.import_animations = True
        a.import_materials = False
        a.import_textures = False
        a.skeleton = skel
        a.mesh_type_to_import = unreal.FBXImportType.FBXIT_ANIMATION
        cname = "A_%s_%s" % (M["name"], clip["name"])
        paths = import_task(clip["file"], dest + "/Anims", cname, a)
        for p in paths:
            anim = unreal.load_asset(p)
            if isinstance(anim, unreal.AnimSequence):
                try:
                    anim.set_editor_property("loop", bool(clip.get("loop")))
                except Exception:  # noqa: BLE001
                    pass
                eal.save_loaded_asset(anim)
        out["imported"] += paths

    # Sesler
    sounds = {}
    for key, ref in (M.get("sounds") or {}).items():
        s = sound_asset(ref, dest, key)
        if s:
            sounds[key] = s.get_path_name()
    out["sounds"] = sounds


# ----------------------------------------------------------------------------- assemble

OPENABLE = ("door", "hood", "bonnet", "trunk", "boot", "lid", "hatch", "tailgate")


def open_rotation(part):
    """Parçayı araçtan dışarı / yukarı açan rotasyon (Unreal bileşen uzayı)"""
    mot = part.get("motion") or {}
    ang = max(abs(float(mot.get("min", 0))), abs(float(mot.get("max", 70)))) or 70.0
    piv = part["pivot"]
    c = [(part["min"][i] + part["max"][i]) / 2 for i in range(3)]
    dx = c[0] - piv[0]
    ax = (mot.get("axis") or "Z").upper()
    if ax == "Y":  # kaput / bagaj: yukarı açılır
        return unreal.Rotator(roll=0.0, pitch=ang * (1 if dx >= 0 else -1), yaw=0.0)
    if ax == "X":  # yukarı açılan kanat kapı
        side = -c[1]  # Unreal Y
        return unreal.Rotator(roll=ang * (-1 if side < 0 else 1), pitch=0.0, yaw=0.0)
    side_ue = -c[1]
    s = (1 if dx >= 0 else -1) * (1 if side_ue >= 0 else -1)
    return unreal.Rotator(roll=0.0, pitch=0.0, yaw=ang * s)


def duplicate(src, dest, name):
    path = dest + "/" + name
    if eal.does_asset_exist(path):
        eal.delete_asset(path)
    obj = eal.duplicate_asset(src, path)
    if not obj:
        raise RuntimeError("kopyalanamadı: %s → %s" % (src, path))
    return obj


def wheel_class(src_cls, dest, name, radius, width, mods):
    src = src_cls.get_outer().get_path_name()
    bp = duplicate(src, dest, name)
    gen = unreal.BlueprintEditorLibrary.generated_class(bp)
    cdo = unreal.get_default_object(gen)
    cdo.set_editor_property("wheel_radius", radius)
    cdo.set_editor_property("wheel_width", width)
    for k, v in mods.items():
        try:
            cdo.set_editor_property(k, v)
        except Exception:  # noqa: BLE001
            pass
    unreal.BlueprintEditorLibrary.compile_blueprint(bp)
    eal.save_loaded_asset(bp)
    return unreal.BlueprintEditorLibrary.generated_class(bp)


def step_assemble():
    dest = M["dest"]
    asm = M["assembly"]
    mesh = unreal.load_asset(M["mesh"])
    parts = asm.get("parts", [])
    dims = asm["dims"]
    L, W, H = dims[0] * 100, dims[1] * 100, dims[2] * 100
    bp = duplicate(M["template"], dest, "BP_" + M["name"])
    gen = unreal.BlueprintEditorLibrary.generated_class(bp)
    cdo = unreal.get_default_object(gen)
    comp = cdo.get_editor_property("mesh")
    comp.set_editor_property("skeletal_mesh_asset", mesh)
    if M.get("anim_bp"):
        abp = unreal.load_asset(M["anim_bp"])
        if abp:
            comp.set_editor_property("anim_class", unreal.BlueprintEditorLibrary.generated_class(abp))
    if M.get("physics_asset"):
        pa = unreal.load_asset(M["physics_asset"])
        if pa:
            mesh.set_editor_property("physics_asset", pa)
            eal.save_loaded_asset(mesh)

    # Tekerlekler: ön/arka sınıfı şablondan kopyala, ölçüyü modelden al
    wheels = [p for p in parts if p.get("role") in ("wheel", "tire")]
    mv = cdo.get_editor_property("vehicle_movement_component")
    tmpl = list(mv.get_editor_property("wheel_setups"))
    if wheels and tmpl:
        front_src = tmpl[0].get_editor_property("wheel_class")
        rear_src = tmpl[-1].get_editor_property("wheel_class")
        xs = sorted(p["pivot"][0] for p in wheels)
        mid = (xs[0] + xs[-1]) / 2
        front = [p for p in wheels if p["pivot"][0] >= mid]
        rear = [p for p in wheels if p["pivot"][0] < mid]

        def measure(group):
            r = max((g["max"][2] - g["min"][2]) / 2 for g in group) * 100
            w = max(g["max"][1] - g["min"][1] for g in group) * 100
            return r, w

        fr, fw = measure(front or wheels)
        rr, rw = measure(rear or wheels)
        fcls = wheel_class(front_src, dest, "WC_%s_Front" % M["name"], fr, fw, {})
        rcls = wheel_class(rear_src, dest, "WC_%s_Rear" % M["name"], rr, rw, {})
        setups = []
        order = sorted(front, key=lambda p: -p["pivot"][1]) + sorted(rear, key=lambda p: -p["pivot"][1])  # ön sol, ön sağ, arka sol, arka sağ
        for p in order:
            ws = unreal.ChaosWheelSetup()
            ws.set_editor_property("bone_name", p["name"])
            ws.set_editor_property("wheel_class", fcls if p in front else rcls)
            setups.append(ws)
        mv.set_editor_property("wheel_setups", setups)
        out["notes"].append("tekerlek: %d (ön r=%.0f cm g=%.0f, arka r=%.0f cm g=%.0f)" % (len(setups), fr, fw, rr, rw))
    else:
        out["errors"].append("tekerlek parçası yok; şablonun tekerlek ayarları duruyor")

    # Kapılar / kaput / bagaj (en fazla 4: Anim BP sınırı)
    sounds = M.get("sounds_ue") or {}

    def snd(*keys):
        for k in keys:
            if sounds.get(k):
                return unreal.load_asset(sounds[k])
        return None

    doors = []
    door_parts = [p for p in parts if any(k in (p.get("role") or p["name"]).lower() for k in OPENABLE)][:4]
    for p in door_parts:
        d = unreal.KVDoor()
        d.set_editor_property("bone_name", p["name"])
        d.set_editor_property("open_rotation", open_rotation(p))
        kind = "trunk" if any(k in p["name"] for k in ("trunk", "boot", "tailgate")) else ("hood" if any(k in p["name"] for k in ("hood", "bonnet")) else "door")
        d.set_editor_property("open_sound", snd(kind + "_open", "door_open"))
        d.set_editor_property("close_sound", snd(kind + "_close", "door_close"))
        doors.append(d)
    cdo.set_editor_property("doors", doors)
    out["door_bones"] = [p["name"] for p in door_parts]

    # Koltuklar: sol ön kapı sürücü, sağ ön kapı yolcu
    side_doors = [(i, p) for i, p in enumerate(door_parts) if (p.get("role") or "door") == "door" or "door" in p["name"]]

    def door_for(left):
        for i, p in side_doors:
            if (p["pivot"][1] > 0) == left:
                return i
        return -1

    if wheels:
        xs = [p["pivot"][0] for p in wheels]
        seat_x = ((max(xs) + min(xs)) / 2 - 0.05 * dims[0]) * 100
    else:
        seat_x = 0.0
    seats = []
    for label, left, driver in (("Driver", True, True), ("Passenger", False, False)):
        s = unreal.KVSeat()
        sy = (-1 if left else 1)
        s.set_editor_property("seat_name", label)
        s.set_editor_property("is_driver", driver)
        s.set_editor_property("seat_offset", unreal.Vector(seat_x, sy * W * 0.21, H * 0.38))
        s.set_editor_property("entry_offset", unreal.Vector(seat_x, sy * (W / 2 + 60), 0))
        s.set_editor_property("exit_offset", unreal.Vector(seat_x, sy * (W / 2 + 120), 0))
        s.set_editor_property("door_index", door_for(left))
        seats.append(s)
    cdo.set_editor_property("seats", seats)

    # Farlar ve egzoz: soketlerden ya da gövde ölçüsünden
    sockets = asm.get("sockets", [])
    lights = {c.get_name(): c for c in cdo.get_components_by_class(unreal.SpotLightComponent)}
    hl = [s for s in sockets if "headlight" in (s.get("use") or s["name"])]
    for cname, left in (("HeadlightLeft", True), ("HeadlightRight", False)):
        c = lights.get(cname)
        if not c:
            continue
        pick = [s for s in hl if (s["location"][1] > 0) == left]
        loc = cm(pick[0]["location"]) if pick else unreal.Vector(L / 2 - 8, (-1 if left else 1) * W * 0.33, H * 0.45)
        c.set_editor_property("relative_location", loc)
    fx = [c for c in cdo.get_components_by_class(unreal.ActorComponent) if c.get_class().get_name() == "KVVehicleFXComponent"]
    ex = [s for s in sockets if "exhaust" in (s.get("use") or s["name"])]
    if fx:
        tr = []
        for s in ex or [{"location": [-dims[0] / 2 + 0.05, -0.35 * dims[1], 0.25 * dims[2]]}]:
            t = unreal.Transform()
            t.translation = cm(s["location"])
            t.rotation = unreal.Rotator(roll=0.0, pitch=0.0, yaw=180.0).quaternion()
            tr.append(t)
        fx[0].set_editor_property("exhaust_transforms", tr)
        out["notes"].append("egzoz noktası: %d" % len(tr))

    # Sesler
    eng = snd("engine")
    if eng:
        cdo.set_editor_property("engine_loop_sound", eng)
        if isinstance(eng, unreal.MetaSoundSource):
            # Katmanlı MetaSound perdeyi kendisi yapar; araç yalnızca devir oranını (0-1) gönderir
            cdo.set_editor_property("engine_pitch_range", unreal.Vector2D(1.0, 1.0))
            cdo.set_editor_property("engine_rpm_parameter", M.get("engine_rpm_parameter") or "RPMAlpha")
    for key, prop in (("engine_start", "engine_start_sound"), ("engine_stop", "engine_stop_sound"), ("horn", "horn_sound")):
        s = snd(key)
        if s:
            cdo.set_editor_property(prop, s)

    unreal.BlueprintEditorLibrary.compile_blueprint(bp)
    eal.save_loaded_asset(bp)
    out["blueprint"] = bp.get_path_name()
    out["notes"].append("Blueprint: %s (şablon %s)" % (bp.get_name(), M["template"].rsplit("/", 1)[-1]))


try:
    if M["step"] == "import":
        step_import()
    else:
        step_assemble()
except Exception as e:  # noqa: BLE001
    out["errors"].append("%s: %s" % (type(e).__name__, e))
print("FORGE_RESULT " + json.dumps(out))
