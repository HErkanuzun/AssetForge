# SPDX-License-Identifier: AGPL-3.0-only
# AssetForge — Unreal Editor içinde çalışan import betiği.
# AssetForge bu dosyanın başına MANIFEST değişkenini ekler. Elle çalıştırmak için export klasöründeki
# ue_import_*.py dosyasını Unreal'da File → Execute Python Script ile açabilirsiniz.
#
# MANIFEST = {
#   "master_material": "/Game/Materials/M_Master" | "",
#   "items": [ {"file": "...", "dest": "/Game/AssetForge/YAP", "name": "SM_...", "type": "static_mesh"|"skeletal_mesh"|"texture"|"sound",
#               "textures": {"BaseColor": "...png", "Normal": "...", "Roughness": "...", "Metallic": "..."},
#               # skeletal_mesh: "lods": [0.5, 0.25, 0.1], "ik_rig": true, "retarget_source_ik_rig": "/Game/.../IK_Mannequin"
#               # dynamic_sound: "layers": [{"file": "...wav", "name": "SW_..._L0", "base_rpm": 900}], "inputs": {"idle": 900, "max": 7000}
#             } ]
# }

import json
import math
import os

import unreal

asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
results = []


def make_task(filename, dest, name, options=None):
    task = unreal.AssetImportTask()
    task.filename = filename
    task.destination_path = dest
    task.destination_name = name
    task.automated = True
    task.replace_existing = True
    task.save = True
    if options is not None:
        task.options = options
    return task


def import_one(task):
    asset_tools.import_asset_tasks([task])
    return list(task.imported_object_paths or [])


TEX_SETTINGS = {
    "Normal": (unreal.TextureCompressionSettings.TC_NORMALMAP, False),
    "Roughness": (unreal.TextureCompressionSettings.TC_MASKS, False),
    "Metallic": (unreal.TextureCompressionSettings.TC_MASKS, False),
}

# ---------------------------------------------------------------------------
# Dinamik motor sesi: devir katmanları → MetaSound (RPM + Throttle girişli)
# Her katman kendi taban devrine göre perdelenir: pitch = 12*log2(RPM/taban).
# Crossfade düğümü komşu katmanları karıştırır: konum = 12*log2(RPM/taban0) / aralık.
# Oyunda: AudioComponent.SetFloatParameter("RPM", devir), ("Throttle", 0..1).

def fresh_asset(name, dest, cls, factory):
    """Aynı adlı asset varsa onu yeniden kullanır (içeriğini çağıran sıfırlar), yoksa oluşturur."""
    path = dest + "/" + name
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        existing = unreal.load_asset(path)
        if isinstance(existing, cls):
            return existing
        raise RuntimeError("%s zaten var ve türü farklı (%s)" % (path, type(existing).__name__))
    asset = asset_tools.create_asset(name, dest, cls, factory)
    if asset is None:
        raise RuntimeError("asset oluşturulamadı: " + path)
    return asset


def reset_ik_rig(ctrl):
    for c in list(ctrl.get_retarget_chains()):
        ctrl.remove_retarget_chain(c.get_editor_property("chain_name"))
    while ctrl.get_num_solvers() > 0:
        ctrl.remove_solver(0)
    for g in list(ctrl.get_all_goals()):
        ctrl.remove_goal(g.get_editor_property("goal_name"))


def _ms_ok(res, what):
    if isinstance(res, tuple):
        status = res[-1]
        value = res[0] if len(res) > 1 else None
    else:
        status, value = res, None
    if isinstance(status, unreal.MetaSoundBuilderResult) and status != unreal.MetaSoundBuilderResult.SUCCEEDED:
        raise RuntimeError("MetaSound adımı başarısız: " + what)
    return value


def _ms_lit(kind, value):
    sub = unreal.get_engine_subsystem(unreal.MetaSoundBuilderSubsystem)
    r = getattr(sub, "create_%s_meta_sound_literal" % kind)(value)
    return r[0] if isinstance(r, tuple) else r


def _ms_class(ns, name, variant=""):
    c = unreal.MetasoundFrontendClassName()
    c.set_editor_property("namespace", ns)
    c.set_editor_property("name", name)
    c.set_editor_property("variant", variant)
    return c


def build_engine_metasound(dest, name, waves, bases):
    sub = unreal.get_engine_subsystem(unreal.MetaSoundBuilderSubsystem)
    res = sub.create_source_builder(name + "_ForgeBuilder", unreal.MetaSoundOutputAudioFormat.MONO, False)
    builder, on_play, audio_outs = res[0], res[1], res[3]

    def node(ns, nm, variant=""):
        return _ms_ok(builder.add_node_by_class_name(_ms_class(ns, nm, variant)), "düğüm " + nm + " " + variant)

    def pin_in(h, n):
        return _ms_ok(builder.find_node_input_by_name(h, n), "giriş " + n)

    def pin_out(h, n):
        return _ms_ok(builder.find_node_output_by_name(h, n), "çıkış " + n)

    def link(out_pin, in_pin, what):
        _ms_ok(builder.connect_nodes(out_pin, in_pin), "bağlantı " + what)

    def default(in_pin, kind, value):
        _ms_ok(builder.set_node_input_default(in_pin, _ms_lit(kind, value)), "varsayılan")

    rpm = _ms_ok(builder.add_graph_input_node("RPM", "Float", _ms_lit("float", float(bases[0])), False), "RPM girişi")
    thr = _ms_ok(builder.add_graph_input_node("Throttle", "Float", _ms_lit("float", 1.0), False), "Throttle girişi")

    def semitones_from(base):
        mul = node("UE", "Multiply", "Float")
        link(rpm, pin_in(mul, "PrimaryOperand"), "rpm→çarp")
        default(pin_in(mul, "AdditionalOperands"), "float", 1.0 / float(base))
        st = node("UE", "Frequency Multiplier to Semitone", "Float")
        link(pin_out(mul, "Out"), pin_in(st, "Frequency Multiplier"), "oran→yarım ton")
        return pin_out(st, "Semitones")

    players = []
    for wave, base in zip(waves, bases, strict=False):
        wp = node("UE", "Wave Player", "Mono")
        link(on_play, pin_in(wp, "Play"), "OnPlay→Play")
        default(pin_in(wp, "Wave Asset"), "object", wave)
        default(pin_in(wp, "Loop"), "bool", True)
        link(semitones_from(base), pin_in(wp, "Pitch Shift"), "perde")
        players.append(pin_out(wp, "Out Mono"))

    if len(players) == 1:
        mixed = players[0]
    else:
        n = len(players)
        step = 12.0 * math.log2(float(bases[1]) / float(bases[0]))
        xf = node("Crossfade", "Trigger Route (Audio, %d)" % n, "Audio")
        pos = node("UE", "Multiply", "Float")
        link(semitones_from(bases[0]), pin_in(pos, "PrimaryOperand"), "konum")
        default(pin_in(pos, "AdditionalOperands"), "float", 1.0 / step)
        link(pin_out(pos, "Out"), pin_in(xf, "Crossfade Value"), "konum→crossfade")
        for i, p in enumerate(players):
            link(p, pin_in(xf, "In %d" % i), "katman %d" % i)
        mixed = pin_out(xf, "Out")

    # Gaz: yükte tam ses, gaz kesikken biraz kısık
    rng = node("MapRange", "MapRange", "Float")
    link(thr, pin_in(rng, "In"), "throttle")
    default(pin_in(rng, "In Range A"), "float", 0.0)
    default(pin_in(rng, "In Range B"), "float", 1.0)
    default(pin_in(rng, "Out Range A"), "float", 0.55)
    default(pin_in(rng, "Out Range B"), "float", 1.0)
    default(pin_in(rng, "Clamped"), "bool", True)
    gain = node("UE", "Multiply", "Audio by Float")
    link(mixed, pin_in(gain, "PrimaryOperand"), "ses→kazanç")
    link(pin_out(rng, "Out Value"), pin_in(gain, "AdditionalOperands"), "gaz→kazanç")
    link(pin_out(gain, "Out"), audio_outs[0], "çıkış")

    path = dest + "/" + name
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        # Kayıtlı MetaSound üzerine yazılamıyor: eskisini kenara al, yenisini aynı adla kur
        import time
        old = "%s/_Old/%s_%d" % (dest, name, int(time.time()))
        if not unreal.EditorAssetLibrary.rename_asset(path, old):
            raise RuntimeError("eski MetaSound taşınamadı: " + path)
        unreal.EditorAssetLibrary.delete_asset(old)
    editor = unreal.get_editor_subsystem(unreal.MetaSoundEditorSubsystem)
    _ms_ok(editor.build_to_asset(builder, "AssetForge", name, dest), "asset kaydı")
    unreal.EditorAssetLibrary.save_asset(path)
    return path


# ---------------------------------------------------------------------------
# Karakter: LOD'lar + IK Rig + (varsa) Manny → karakter retargeter

def setup_character(mesh, dest, base, lods, source_ik_rig_path):
    out, notes = [], []
    if lods:
        # LOD yüzdeleri bir SkeletalMeshLODSettings asset'i üzerinden verilir (lod_info Python'a kapalı)
        fac = unreal.DataAssetFactory()
        fac.set_editor_property("data_asset_class", unreal.SkeletalMeshLODSettings)
        lod_asset = fresh_asset("LODS_" + base, dest, unreal.SkeletalMeshLODSettings, fac)
        screens = [1.0, 0.5, 0.25, 0.12, 0.06, 0.03]
        groups = []
        for i, pct in enumerate([1.0] + list(lods)):
            g = unreal.SkeletalMeshLODGroupSettings()
            opt = g.get_editor_property("reduction_settings")
            opt.set_editor_property("num_of_triangles_percentage", float(pct))
            g.set_editor_property("reduction_settings", opt)
            ss = unreal.PerPlatformFloat()
            ss.set_editor_property("default", screens[min(i, len(screens) - 1)])
            g.set_editor_property("screen_size", ss)
            groups.append(g)
        lod_asset.set_editor_property("lod_groups", groups)
        unreal.EditorAssetLibrary.save_loaded_asset(lod_asset)
        mesh.set_editor_property("lod_settings", lod_asset)
        sub = unreal.get_editor_subsystem(unreal.SkeletalMeshEditorSubsystem)
        if sub.regenerate_lod(mesh, len(groups), True, False):
            counts = [sub.get_num_verts(mesh, i) for i in range(sub.get_lod_count(mesh))]
            notes.append("LOD: %d seviye (%s) · vertex: %s" % (len(groups), ", ".join("%d%%" % round(p * 100) for p in lods), "/".join(str(c) for c in counts)))
        else:
            notes.append("LOD üretilemedi")
        unreal.EditorAssetLibrary.save_loaded_asset(mesh)
        out.append(lod_asset.get_path_name())

    rig = fresh_asset("IK_" + base, dest, unreal.IKRigDefinition, unreal.IKRigDefinitionFactory())
    ctrl = unreal.IKRigController.get_controller(rig)
    reset_ik_rig(ctrl)
    ctrl.set_skeletal_mesh(mesh)
    chains = ctrl.apply_auto_generated_retarget_definition()
    fbik = ctrl.apply_auto_fbik()
    unreal.EditorAssetLibrary.save_loaded_asset(rig)
    out.append(rig.get_path_name())
    notes.append("IK Rig: zincirler %s, FBIK %s" % ("otomatik" if chains else "tanınmadı", "var" if fbik else "yok"))

    if source_ik_rig_path and unreal.EditorAssetLibrary.does_asset_exist(source_ik_rig_path):
        src = unreal.load_asset(source_ik_rig_path)
        rtg = fresh_asset("RTG_Manny_To_" + base, dest, unreal.IKRetargeter, unreal.IKRetargetFactory())
        rc = unreal.IKRetargeterController.get_controller(rtg)
        rc.remove_all_ops()
        rc.set_ik_rig(unreal.RetargetSourceOrTarget.SOURCE, src)
        rc.set_ik_rig(unreal.RetargetSourceOrTarget.TARGET, rig)
        rc.add_default_ops()
        rc.assign_ik_rig_to_all_ops(unreal.RetargetSourceOrTarget.SOURCE, src)
        rc.assign_ik_rig_to_all_ops(unreal.RetargetSourceOrTarget.TARGET, rig)
        rc.auto_map_chains(unreal.AutoMapChainType.FUZZY, True)
        rc.auto_align_all_bones(unreal.RetargetSourceOrTarget.TARGET)
        unreal.EditorAssetLibrary.save_loaded_asset(rtg)
        out.append(rtg.get_path_name())
        notes.append("Retargeter: Manny → " + base)
    elif source_ik_rig_path:
        notes.append("Manny IK Rig bulunamadı (%s) — retargeter atlandı" % source_ik_rig_path)
    return out, notes


# ---------------------------------------------------------------------------
# Kimodo animasyonu: ortak SOMA iskeletine import → IK Rig → hedef karakterlere toplu retarget

def ensure_ik_rig(mesh, dest, base):
    path = dest + "/IK_" + base
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        return unreal.load_asset(path)
    rig = fresh_asset("IK_" + base, dest, unreal.IKRigDefinition, unreal.IKRigDefinitionFactory())
    ctrl = unreal.IKRigController.get_controller(rig)
    ctrl.set_skeletal_mesh(mesh)
    ctrl.apply_auto_generated_retarget_definition()
    ctrl.apply_auto_fbik()
    unreal.EditorAssetLibrary.save_loaded_asset(rig)
    return rig


def make_retargeter(name, dest, src_rig, tgt_rig):
    rtg = fresh_asset(name, dest, unreal.IKRetargeter, unreal.IKRetargetFactory())
    rc = unreal.IKRetargeterController.get_controller(rtg)
    rc.remove_all_ops()
    rc.set_ik_rig(unreal.RetargetSourceOrTarget.SOURCE, src_rig)
    rc.set_ik_rig(unreal.RetargetSourceOrTarget.TARGET, tgt_rig)
    rc.add_default_ops()
    rc.assign_ik_rig_to_all_ops(unreal.RetargetSourceOrTarget.SOURCE, src_rig)
    rc.assign_ik_rig_to_all_ops(unreal.RetargetSourceOrTarget.TARGET, tgt_rig)
    rc.auto_map_chains(unreal.AutoMapChainType.FUZZY, True)
    rc.auto_align_all_bones(unreal.RetargetSourceOrTarget.TARGET)
    unreal.EditorAssetLibrary.save_loaded_asset(rtg)
    return rtg


def apply_clip_meta(anim, item):
    """Döngü bayrağı + ayak basışı sync marker'ları (L/R) — Blend Space / Motion Matching senkronu için."""
    notes = []
    if item.get("loop") is not None:
        try:
            anim.set_editor_property("loop", bool(item["loop"]))
        except Exception:  # noqa: BLE001 — eski sürümlerde yok
            pass
    mk = item.get("markers") or {}
    if mk.get("L") or mk.get("R"):
        lib = unreal.AnimationLibrary
        try:
            lib.remove_animation_sync_markers_by_track(anim, "FootSync")
        except Exception:  # noqa: BLE001
            pass
        if "FootSync" not in [str(n) for n in lib.get_animation_notify_track_names(anim)]:
            lib.add_animation_notify_track(anim, "FootSync")
        length = anim.get_play_length()
        n = 0
        for side in ("L", "R"):
            for t in mk.get(side) or []:
                if 0 <= t <= length:
                    lib.add_animation_sync_marker(anim, side, float(t), "FootSync")
                    n += 1
        notes.append("sync marker: %d (L/R)" % n)
    return notes


def import_kimodo_anim(item, entry):
    soma_dest = item.get("soma_dest") or "/Game/AssetForge/Animation/SOMA"
    soma_path = soma_dest + "/SK_ForgeSOMA"
    clip = item["name"]
    opts = unreal.FbxImportUI()
    opts.import_animations = True
    opts.import_materials = False
    opts.import_textures = False
    first = not unreal.EditorAssetLibrary.does_asset_exist(soma_path)
    if first:
        opts.import_mesh = True
        opts.import_as_skeletal = True
        opts.mesh_type_to_import = unreal.FBXImportType.FBXIT_SKELETAL_MESH
        paths = import_one(make_task(item["file"], soma_dest, "SK_ForgeSOMA", opts))
    else:
        soma_mesh = unreal.load_asset(soma_path)
        opts.import_mesh = False
        opts.import_as_skeletal = True
        opts.skeleton = soma_mesh.get_editor_property("skeleton")
        opts.mesh_type_to_import = unreal.FBXImportType.FBXIT_ANIMATION
        paths = import_one(make_task(item["file"], soma_dest, clip, opts))
    anim = None
    for p in paths:
        a = unreal.load_asset(p)
        if isinstance(a, unreal.AnimSequence):
            anim = a
    if anim is None:
        raise RuntimeError("FBX'ten animasyon çıkmadı")
    want = soma_dest + "/" + clip
    if anim.get_path_name().split(".")[0] != want:
        if unreal.EditorAssetLibrary.does_asset_exist(want):
            unreal.EditorAssetLibrary.delete_asset(want)
        unreal.EditorAssetLibrary.rename_asset(anim.get_path_name().split(".")[0], want)
        anim = unreal.load_asset(want)
    if item.get("root_motion", True):
        anim.set_editor_property("enable_root_motion", True)
    entry["notes"] += apply_clip_meta(anim, item)
    unreal.EditorAssetLibrary.save_loaded_asset(anim)
    entry["imported"].append(want)
    entry["notes"].append("Kimodo klibi: %s (%.1f sn)" % (clip, anim.get_editor_property("sequence_length") if hasattr(anim, "sequence_length") else 0))

    soma_mesh = unreal.load_asset(soma_path)
    soma_rig = ensure_ik_rig(soma_mesh, soma_dest, "ForgeSOMA")
    for tgt in item.get("targets") or []:
        mesh = unreal.load_asset(tgt["mesh"])
        if not isinstance(mesh, unreal.SkeletalMesh):
            entry["errors"].append("hedef karakter bulunamadı: " + tgt["mesh"])
            continue
        tdir = tgt["mesh"].rsplit("/", 1)[0]
        tbase = tgt["base"]
        tgt_rig = unreal.load_asset(tgt.get("ik_rig") or (tdir + "/IK_" + tbase)) or ensure_ik_rig(mesh, tdir, tbase)
        rtg_name = "RTG_SOMA_To_" + tbase
        rtg_path = tdir + "/" + rtg_name
        rtg = unreal.load_asset(rtg_path) if unreal.EditorAssetLibrary.does_asset_exist(rtg_path) else make_retargeter(rtg_name, tdir, soma_rig, tgt_rig)
        inputs = unreal.IKRetargetBatchOperationInputs()
        inputs.set_editor_property("assets_to_retarget", [unreal.EditorAssetLibrary.find_asset_data(want)])
        inputs.set_editor_property("ik_retarget_asset", rtg)
        inputs.set_editor_property("search", "AS_SOMA_")
        inputs.set_editor_property("replace", "A_%s_" % tbase)
        inputs.set_editor_property("overwrite_existing_files", True)
        inputs.set_editor_property("include_referenced_assets", False)
        out_dir = tgt.get("dest") or (tdir + "/Animations")
        for key, val in (("target_path", out_dir), ("use_source_path", False), ("source_mesh", soma_mesh), ("target_mesh", mesh)):
            try:
                inputs.set_editor_property(key, val)
            except Exception:  # noqa: BLE001 — alan bu sürümde yoksa geç
                pass
        made = unreal.IKRetargetBatchOperation.run_batch_retarget(inputs)
        for ad in made or []:
            entry["imported"].append(str(ad.package_name))
            out = unreal.load_asset(str(ad.package_name))
            if isinstance(out, unreal.AnimSequence):
                apply_clip_meta(out, item)
                if item.get("root_motion", True):
                    out.set_editor_property("enable_root_motion", True)
                unreal.EditorAssetLibrary.save_loaded_asset(out)
        entry["notes"].append("retarget → %s: %d animasyon" % (tbase, len(made or [])))


for item in MANIFEST["items"]:  # noqa: F821 — MANIFEST üstte eklenir
    entry = {"name": item["name"], "imported": [], "errors": [], "notes": []}
    try:
        if item["type"] == "animation":
            import_kimodo_anim(item, entry)
            results.append(entry)
            continue
        if item["type"] == "dynamic_sound":
            waves, bases = [], []
            for layer in item["layers"]:
                paths = import_one(make_task(layer["file"], item["dest"] + "/Layers", layer["name"]))
                if not paths:
                    raise RuntimeError("katman içe aktarılamadı: " + layer["file"])
                wave = unreal.load_asset(paths[0])
                wave.set_editor_property("looping", True)
                unreal.EditorAssetLibrary.save_loaded_asset(wave)
                waves.append(wave)
                bases.append(layer["base_rpm"])
                entry["imported"] += paths
            entry["imported"].append(build_engine_metasound(item["dest"], item["name"], waves, bases))
            entry["notes"].append("MetaSound: %d devir katmanı, girişler RPM + Throttle" % len(waves))
            results.append(entry)
            continue
        options = None
        if item["file"].lower().endswith(".fbx") and item["type"] in ("static_mesh", "skeletal_mesh"):
            options = unreal.FbxImportUI()
            options.import_mesh = True
            options.import_materials = True
            options.import_textures = True
            options.import_as_skeletal = item["type"] == "skeletal_mesh"
            options.import_animations = item["type"] == "skeletal_mesh"
            options.mesh_type_to_import = (
                unreal.FBXImportType.FBXIT_SKELETAL_MESH if item["type"] == "skeletal_mesh" else unreal.FBXImportType.FBXIT_STATIC_MESH
            )
            if item["type"] == "static_mesh":
                options.static_mesh_import_data.combine_meshes = True
                options.static_mesh_import_data.generate_lightmap_u_vs = True
        entry["imported"] += import_one(make_task(item["file"], item["dest"], item["name"], options))
        if item["type"] == "skeletal_mesh" and (item.get("lods") or item.get("ik_rig")):
            mesh = unreal.load_asset(item["dest"] + "/" + item["name"])
            if isinstance(mesh, unreal.SkeletalMesh):
                base = item["name"].split("_", 1)[-1]
                paths, notes = setup_character(mesh, item["dest"], base, item.get("lods") or [], item.get("retarget_source_ik_rig") or "")
                entry["imported"] += paths
                entry["notes"] += notes
            else:
                entry["errors"].append("iskelet mesh bulunamadı; LOD/IK atlandı")

        # Ayrı PBR dokular + opsiyonel materyal instance
        tex_assets = {}
        for role, path in (item.get("textures") or {}).items():
            if not os.path.exists(path):
                continue
            tname = os.path.splitext(os.path.basename(path))[0]
            paths = import_one(make_task(path, item["dest"] + "/Textures", tname))
            if not paths:
                continue
            tex = unreal.load_asset(paths[0])
            if role in TEX_SETTINGS and tex:
                comp, srgb = TEX_SETTINGS[role]
                tex.set_editor_property("compression_settings", comp)
                tex.set_editor_property("srgb", srgb)
                unreal.EditorAssetLibrary.save_loaded_asset(tex)
            tex_assets[role] = tex
            entry["imported"] += paths

        master = MANIFEST.get("master_material") or ""  # noqa: F821 — MANIFEST üstte eklenir
        if master and tex_assets and item["type"] in ("static_mesh", "skeletal_mesh"):
            parent = unreal.load_asset(master)
            if parent:
                mi_name = "MI_" + item["name"].split("_", 1)[-1]
                mi = asset_tools.create_asset(mi_name, item["dest"], unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
                unreal.MaterialEditingLibrary.set_material_instance_parent(mi, parent)
                for role, tex in tex_assets.items():
                    unreal.MaterialEditingLibrary.set_material_instance_texture_parameter_value(mi, role, tex)
                unreal.EditorAssetLibrary.save_loaded_asset(mi)
                mesh = unreal.load_asset(item["dest"] + "/" + item["name"])
                if isinstance(mesh, unreal.StaticMesh):
                    mesh.set_material(0, mi)
                    unreal.EditorAssetLibrary.save_loaded_asset(mesh)
                entry["imported"].append(mi.get_path_name())
            else:
                entry["errors"].append("master materyal bulunamadı: " + master)
    except Exception as e:  # noqa: BLE001
        entry["errors"].append(str(e))
    results.append(entry)

print("FORGE_RESULT " + json.dumps(results))
