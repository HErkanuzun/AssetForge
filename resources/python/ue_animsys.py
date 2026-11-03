# SPDX-License-Identifier: AGPL-3.0-only
# AssetForge — animasyon sistemini Unreal Editor içinde kuran betik.
# AssetForge başına SYSTEM değişkenini ekler:
# SYSTEM = {"kind": "blendspace2d", "name": "Lokomosyon", "dest": "/Game/.../AnimSystems/Lokomosyon",
#           "axes": {"x": {"name","min","max","grid"}, "y": {...}},
#           "clips": [{"key","label","role","loop","rootMotion","paths": [hedef, SOMA],
#                      "sample": {"x","y"}, "markers": {"L": [sn], "R": [sn]}, "measured": {...}}]}
# Kurulanlar: Blend Space 1D/2D, Aim Offset, Anim Montage, Pose Search Schema + Database (Motion Matching),
# döngü bayrakları ve L/R sync marker'lar. AnimBP grafiği Python ile çizilemez → rehber notları.

import json

import unreal

eal = unreal.EditorAssetLibrary
at = unreal.AssetToolsHelpers.get_asset_tools()
lib = unreal.AnimationLibrary
S = SYSTEM  # noqa: F821 — üstte eklenir
notes, errors, made = [], [], []


def fresh(name, dest, cls, factory):
    path = dest + "/" + name
    if eal.does_asset_exist(path):
        eal.delete_asset(path)
    return at.create_asset(name, dest, cls, factory)


def resolve(c):
    for p in c["paths"]:
        if eal.does_asset_exist(p):
            a = unreal.load_asset(p)
            if isinstance(a, unreal.AnimSequence):
                return a
    return None


def prep(anim, c):
    """Döngü, root motion ve L/R sync marker'lar (yeniden kurulumda tekrar yazılır)."""
    try:
        anim.set_editor_property("loop", bool(c["loop"]))
    except Exception:  # noqa: BLE001
        pass
    anim.set_editor_property("enable_root_motion", c.get("rootMotion") == "root")
    mk = c.get("markers") or {}
    if mk.get("L") or mk.get("R"):
        try:
            lib.remove_animation_sync_markers_by_track(anim, "FootSync")
        except Exception:  # noqa: BLE001
            pass
        if "FootSync" not in [str(n) for n in lib.get_animation_notify_track_names(anim)]:
            lib.add_animation_notify_track(anim, "FootSync")
        length = anim.get_play_length()
        for side in ("L", "R"):
            for t in mk.get(side) or []:
                if 0 <= t <= length:
                    lib.add_animation_sync_marker(anim, side, float(t), "FootSync")


def set_axes(bs, axes):
    bp = bs.get_editor_property("blend_parameters")
    for i, k in enumerate(["x", "y"]):
        ax = (axes or {}).get(k)
        if not ax or i >= len(bp):
            continue
        p = bp[i]
        p.set_editor_property("display_name", ax["name"])
        p.set_editor_property("min", float(ax["min"]))
        p.set_editor_property("max", float(ax["max"]))
        p.set_editor_property("grid_num", int(ax.get("grid", 4)))
        bp[i] = p
    bs.set_editor_property("blend_parameters", bp)


def sample(anim, x, y=0.0):
    s = unreal.BlendSample()
    s.set_editor_property("animation", anim)
    s.set_editor_property("sample_value", unreal.Vector(float(x), float(y or 0), 0))
    return s


def save(a):
    eal.save_loaded_asset(a, False)
    made.append(a.get_path_name().split(".")[0])


# ---------------------------------------------------------------------------
anims = {}
for c in S["clips"]:
    a = resolve(c)
    if a is None:
        errors.append("%s: Unreal'da animasyon yok (%s) — önce klibi üret/import et" % (c["label"], c["paths"][0]))
        continue
    prep(a, c)
    eal.save_loaded_asset(a, False)
    anims[c["key"]] = (a, c)

skel = next(iter(anims.values()))[0].get_editor_property("skeleton") if anims else None
kind = S["kind"]
dest = S["dest"]
name = S["name"]

try:
    if not anims:
        raise RuntimeError("hiç animasyon bulunamadı")

    if kind in ("blendspace1d", "blendspace2d"):
        is1d = kind == "blendspace1d"
        f = unreal.BlendSpaceFactory1D() if is1d else unreal.BlendSpaceFactoryNew()
        f.set_editor_property("target_skeleton", skel)
        bs = fresh(("BS1D_" if is1d else "BS_") + name, dest, unreal.BlendSpace1D if is1d else unreal.BlendSpace, f)
        set_axes(bs, S.get("axes"))
        samples = []
        for a, c in anims.values():
            x, y = c["sample"].get("x", 0), c["sample"].get("y", 0)
            samples.append(sample(a, x, y))
            if not is1d and abs(abs(x) - 180) < 0.5 and c["role"] != "idle":
                samples.append(sample(a, -x, y))  # geri yön ızgaranın iki ucunda
            if not is1d and c["role"] == "idle":
                ax = (S.get("axes") or {}).get("x") or {"min": -180, "max": 180}
                for xx in (ax["min"], ax["max"]):
                    if xx != x:
                        samples.append(sample(a, xx, y))  # bekleme satırı tüm yönlerde
        bs.set_editor_property("sample_data", samples)
        save(bs)
        notes.append("%s: %d örnek (gerçek ölçülen hızlarla), marker tabanlı senkron açık" % (bs.get_name(), len(samples)))
        notes.append("AnimBP: Locomotion durumuna %s ekle → %s" % (bs.get_name(), "Speed = GroundSpeed" if is1d else "Direction = CalculateDirection(Velocity, Rotation), Speed = GroundSpeed"))

    elif kind == "aimoffset":
        center = anims.get("aim_cc")
        if not center:
            raise RuntimeError("merkez poz (aim_cc) yok")
        for a, _c in anims.values():
            a.set_editor_property("additive_anim_type", unreal.AdditiveAnimationType.AAT_ROTATION_OFFSET_MESH_SPACE)
            a.set_editor_property("ref_pose_type", unreal.AdditiveBasePoseType.ABPT_ANIM_FRAME)
            a.set_editor_property("ref_pose_seq", center[0])
            a.set_editor_property("ref_frame_index", 0)
            eal.save_loaded_asset(a, False)
        f = unreal.AimOffsetBlendSpaceFactoryNew()
        f.set_editor_property("target_skeleton", skel)
        ao = fresh("AO_" + name, dest, unreal.AimOffsetBlendSpace, f)
        set_axes(ao, S.get("axes"))
        ao.set_editor_property("sample_data", [sample(a, c["sample"].get("x", 0), c["sample"].get("y", 0)) for a, c in anims.values()])
        save(ao)
        notes.append("%s: %d additive poz (mesh space, referans = merkez pozun 1. karesi)" % (ao.get_name(), len(anims)))
        notes.append("AnimBP: lokomosyondan sonra AimOffset düğümü → Yaw/Pitch = kontrol rotasyonu - aktör rotasyonu (normalize)")

    elif kind == "montage":
        for key, (a, c) in anims.items():
            if c["role"] != "action":
                continue
            f = unreal.AnimMontageFactory()
            f.set_editor_property("target_skeleton", skel)
            f.set_editor_property("source_animation", a)
            m = fresh("AM_" + name + "_" + key, dest, unreal.AnimMontage, f)
            save(m)
        notes.append("%d montaj kuruldu (DefaultSlot). Blueprint: Play Anim Montage; hasar/ses anlarına notify ekle." % sum(1 for _, c in anims.values() if c["role"] == "action"))
        notes.append("Her aksiyon bekleme pozundan başlayıp ona döner → blend in/out 0.15-0.25 sn yeterli")

    elif kind == "motionmatching":
        sch = fresh("PSS_" + name, dest, unreal.PoseSearchSchema, None)
        rs = unreal.PoseSearchRoledSkeleton()
        rs.set_editor_property("skeleton", skel)
        sch.set_editor_property("skeletons", [rs])
        sch.set_editor_property("sample_rate", 30)
        tr = unreal.new_object(unreal.PoseSearchFeatureChannel_Trajectory, outer=sch)
        ts = []
        # GASP benzeri: geçmiş + gelecek; konum XY + bakış XY, şimdiki an hız XY
        for off, fl in [(-0.4, 32 | 128), (-0.2, 32 | 128), (0.0, 16 | 128), (0.35, 32 | 128), (0.7, 32 | 128), (1.0, 32 | 128)]:
            t = unreal.PoseSearchTrajectorySample()
            t.set_editor_property("offset", off)
            t.set_editor_property("flags", fl)
            t.set_editor_property("weight", 1.0)
            ts.append(t)
        tr.set_editor_property("samples", ts)
        tr.set_editor_property("weight", 7.0)
        po = unreal.new_object(unreal.PoseSearchFeatureChannel_Pose, outer=sch)
        bones = []
        for bn, fl in [("foot_l", 1 | 2), ("foot_r", 1 | 2), ("pelvis", 1)]:
            b = unreal.PoseSearchBone()
            r = unreal.BoneReference()
            r.set_editor_property("bone_name", bn)
            b.set_editor_property("reference", r)
            b.set_editor_property("flags", fl)
            b.set_editor_property("weight", 1.0)
            bones.append(b)
        po.set_editor_property("sampled_bones", bones)
        po.set_editor_property("weight", 1.0)
        sch.set_editor_property("channels", [tr, po])
        save(sch)
        db = fresh("PSD_" + name, dest, unreal.PoseSearchDatabase, None)
        db.set_editor_property("schema", sch)
        eal.save_loaded_asset(db, False)
        # Database'e ekleme Python'a açık değil → her klibe BranchIn notify (Database = PSD) + kaydet = otomatik senkron
        for a, _c in anims.values():
            names = [str(n) for n in lib.get_animation_notify_track_names(a)]
            if "PoseSearch" in names:
                lib.remove_animation_notify_track(a, "PoseSearch")
            lib.add_animation_notify_track(a, "PoseSearch")
            ns = lib.add_animation_notify_state_event(a, "PoseSearch", 0.0, a.get_play_length(), unreal.AnimNotifyState_PoseSearchBranchIn)
            ns.set_editor_property("database", db)
            eal.save_loaded_asset(a, False)
        db.modify()
        save(db)
        n = db.get_num_animation_assets()
        if n < len(anims):
            errors.append("Database %d/%d klip aldı — editörde PSD'yi açıp kaydetmek senkronu tamamlar" % (n, len(anims)))
        notes.append("%s: %d klip · %s: trajektori (6 örnek) + ayak/kalça kanalları" % (db.get_name(), n, sch.get_name()))
        notes.append("Karakter: AnimBP'de Pose History → Motion Matching düğümü (Database = %s). Trajektori için CharacterMovementTrajectory bileşeni (GASP)" % db.get_name())

    elif kind == "statemachine":
        notes.append("Durum makinesi (AnimBP → Locomotion SM):")
        notes.append("  Idle --(IsFalling)--> JumpStart --(kalan süre < 0.1)--> JumpLoop(döngü) --(!IsFalling)--> Land --(kalan süre < 0.2)--> Idle")
        notes.append("  Kliplerin uçları komşu durumun pozuyla eşlendi; geçiş süresi 0.1-0.2 sn yeterli")

    else:
        notes.append("Klipler hazırlandı (döngü bayrağı, root motion, sync marker)")

    for a, c in anims.values():
        mk = c.get("markers") or {}
        if mk.get("L") or mk.get("R"):
            notes.append("  %s: L %d · R %d marker%s" % (a.get_name(), len(mk.get("L") or []), len(mk.get("R") or []), " · döngü" if c["loop"] else ""))
except Exception as e:  # noqa: BLE001
    errors.append(str(e))

print("FORGE_RESULT " + json.dumps({"notes": notes, "errors": errors, "assets": made}))
