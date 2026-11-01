# AssetForge — Kimodo çıktısını oyun klibine çeviren yardımcılar (sunucu tarafından içe aktarılır).
#
#  * Kısıtlar: yoğun kök yolu (hız/yön/dönüş), poz eşleme (bir klibin ilk/son pozu başka klibin ucuna),
#  * Döngü kesimi: sol ayak basışından sol ayak basışına en benzer pencereyi bulur, dikişi yayarak kapatır,
#  * Ölçüm: gerçek hız (m/sn), hareket yönü ve dönüş açısı (sağ = +), ayak basış zamanları (sync marker).
#
# Koordinatlar Kimodo ile aynı: Y yukarı, metre; yön açısı θ → bakış (sin θ, cos θ) [x, z]. θ=0 → +Z.
# Kimodo'da +θ sola dönüştür; AssetForge/Unreal tarafında sağ = + kullanıldığı için dışarıya işaret çevrilerek verilir.

import math

import numpy as np
import torch

from kimodo.geometry import axis_angle_to_matrix, matrix_to_axis_angle
from kimodo.motion_rep.feature_utils import compute_heading_angle
from kimodo.skeleton import global_rots_to_local_rots


def ry(theta):
    """Y ekseni etrafında dönüş matrisi; θ (tensör) → [..., 3, 3]."""
    c, s = torch.cos(theta), torch.sin(theta)
    z, o = torch.zeros_like(theta), torch.ones_like(theta)
    return torch.stack([torch.stack([c, z, s], -1), torch.stack([z, o, z], -1), torch.stack([-s, z, c], -1)], -2)


def headings(posed, skeleton):
    """posed [T, J, 3] → bakış açısı [T] (radyan, Kimodo yönü)."""
    return compute_heading_angle(posed[None], skeleton)[0]


def unwrap(a):
    return torch.from_numpy(np.unwrap(a.detach().cpu().numpy())).to(a)


# --------------------------------------------------------------------------- kısıtlar

def pose_constraint(pose, frame, x=0.0, z=0.0, heading_deg_right=0.0):
    """Kanonik poz (kök XZ=0, bakış 0) → verilen konum/yönde tam vücut kısıtı (Kimodo JSON biçimi)."""
    rot = torch.tensor(pose["local_joints_rot"], dtype=torch.float32)
    mats = axis_angle_to_matrix(rot)
    theta = torch.tensor(-math.radians(heading_deg_right), dtype=torch.float32)
    root = int(pose.get("root_idx", 0))
    mats[root] = ry(theta) @ mats[root]
    y = float(pose["root_y"])
    return {
        "type": "fullbody",
        "frame_indices": [int(frame)],
        "local_joints_rot": [matrix_to_axis_angle(mats).tolist()],
        "root_positions": [[float(x), y, float(z)]],
        "smooth_root_2d": [[float(x), float(z)]],
    }


def path_constraint(points, headings_deg_right=None, frames=None):
    """Kare başına [x, z] yolu (+ isteğe bağlı bakış) → root2d kısıtı."""
    n = len(points)
    c = {"type": "root2d", "frame_indices": list(frames) if frames is not None else list(range(n)), "smooth_root_2d": [[float(p[0]), float(p[1])] for p in points]}
    if headings_deg_right is not None:
        th = [-math.radians(h) for h in headings_deg_right]
        c["global_root_heading"] = [[math.cos(t), math.sin(t)] for t in th]
    return c


# --------------------------------------------------------------------------- kanonikleştirme / poz

def mean_heading(posed, skeleton, a=0, b=None):
    """Kalça salınımını yok sayan ortalama bakış (radyan)."""
    h = unwrap(headings(posed, skeleton))
    return h[a:b].mean() if b is None or b > a else h[a]


def canonicalize(local, root_pos, posed, skeleton, frame=0, heading=None):
    """Klibi verilen karede kök XZ=0 ve bakış 0 olacak şekilde döndür/taşı (yerinde değiştirmez)."""
    h = headings(posed, skeleton)[frame] if heading is None else heading
    R = ry(-h)
    local = local.clone()
    r = skeleton.root_idx
    local[:, r] = R @ local[:, r]
    off = root_pos[frame].clone()
    off[1] = 0
    root_pos = (R @ (root_pos - off).unsqueeze(-1)).squeeze(-1)
    posed = (R @ (posed - off).unsqueeze(-1)).squeeze(-1)
    return local, root_pos, posed


def pose_at(local, root_pos, posed, skeleton, frame):
    """Karedeki pozu kanonik olarak döndür (JSON uyumlu)."""
    h = headings(posed, skeleton)[frame]
    m = local[frame].clone()
    r = skeleton.root_idx
    m[r] = ry(-h) @ m[r]
    return {"local_joints_rot": matrix_to_axis_angle(m).tolist(), "root_y": float(root_pos[frame, 1]), "root_idx": int(r)}


# --------------------------------------------------------------------------- ayak temasları

def markers(contacts, fps, loop=False):
    """Sync marker zamanları (sn). Döngüde 0'a L eklenir, sona yapışık tekrarlar atılır."""
    on = contact_onsets(contacts)
    n = len(contacts) - 1
    out = {}
    for side, frames in on.items():
        fr = [f for f in frames if not loop or 3 < f < n - 3]
        if loop and side == "L":
            fr = [0] + fr
        out[side] = [round(f / fps, 4) for f in fr]
    return out


def contact_onsets(contacts):
    """contacts [T, 4] (sol topuk, sol parmak, sağ topuk, sağ parmak) → {L: [kare], R: [kare]} basış anları."""
    c = np.asarray(contacts) > 0.5
    out = {}
    for side, cols in (("L", (0, 1)), ("R", (2, 3))):
        on = c[:, cols[0]] | c[:, cols[1]]
        # 2 karelik titreşimleri yok say
        clean = on.copy()
        for i in range(1, len(on) - 1):
            if on[i - 1] == on[i + 1] != on[i]:
                clean[i] = on[i - 1]
        out[side] = [i for i in range(1, len(clean)) if clean[i] and not clean[i - 1]]
    return out


# --------------------------------------------------------------------------- döngü

def _features(posed, root_pos, skeleton):
    """Kök göreli, bakışa göre hizalanmış eklem konumları ve hızları → [T, F]."""
    h = headings(posed, skeleton)
    R = ry(-h)  # [T, 3, 3]
    rel = posed - torch.stack([root_pos[:, 0], torch.zeros_like(root_pos[:, 1]), root_pos[:, 2]], -1)[:, None]
    rel = (R[:, None] @ rel.unsqueeze(-1)).squeeze(-1)  # [T, J, 3]
    vel = torch.zeros_like(rel)
    vel[1:] = rel[1:] - rel[:-1]
    vel[0] = vel[1]
    return torch.cat([rel.flatten(1), 3.0 * vel.flatten(1)], 1)


def find_loop(posed, root_pos, contacts, skeleton, fps, min_s=0.55, max_s=2.6, skip_s=0.7):
    """En temiz döngü penceresi (a, b) — a ve b sol ayak basışına yakın, poz/hız farkı en düşük."""
    T = posed.shape[0]
    F = _features(posed, root_pos, skeleton)
    skip = min(int(skip_s * fps), T // 3)
    lo, hi = int(min_s * fps), int(max_s * fps)
    on = [i for i in contact_onsets(contacts)["L"] if i >= skip]
    best = None
    pairs = []
    for i, a in enumerate(on):
        for b in on[i + 1:i + 3]:
            if lo <= b - a <= hi:
                pairs.append((a, b, 0.0 if b == on[i + 1] else 0.08))
    if pairs:
        for a, b0, pen in pairs:
            for b in range(max(a + lo, b0 - 3), min(T - 1, b0 + 3) + 1):
                cost = float(((F[a] - F[b]) ** 2).mean()) * (1 + pen)
                if best is None or cost < best[2]:
                    best = (a, b, cost)
    if best is None:  # ayak basışı yok (ör. bekleme) → kaba arama
        for a in range(skip, max(skip + 1, T - lo)):
            d = ((F[a + lo:min(T, a + hi + 1)] - F[a]) ** 2).mean(1)
            if len(d) == 0:
                continue
            k = int(torch.argmin(d))
            cost = float(d[k])
            if best is None or cost < best[2]:
                best = (a, a + lo + k, cost)
    if best is None:
        return 0, T - 1, float("inf")
    return best


def close_loop(local, root_pos, a, b, root_idx=0, keep_yaw=None):
    """[a, b] aralığını kes; b karesi a pozuna eşit olacak şekilde farkı klibe yay (dahil b).
    keep_yaw (radyan): daire/kavis döngülerinde tur başına bakış değişimi korunur."""
    seg = local[a:b + 1].clone()
    pos = root_pos[a:b + 1].clone()
    n = b - a
    target = seg[0].clone()
    if keep_yaw is not None:
        target[root_idx] = ry(torch.as_tensor(float(keep_yaw), dtype=seg.dtype, device=seg.device)) @ target[root_idx]
    D = target @ seg[-1].transpose(-1, -2)  # [J, 3, 3]  R_a · R_bᵀ
    aa = matrix_to_axis_angle(D)  # [J, 3]
    for t in range(n + 1):
        w = t / n
        seg[t] = axis_angle_to_matrix(aa * w) @ seg[t]
    dy = pos[0, 1] - pos[-1, 1]
    for t in range(n + 1):
        pos[t, 1] = pos[t, 1] + dy * (t / n)
    return seg, pos


# --------------------------------------------------------------------------- ölçüm

def measure(root_pos, posed, skeleton, fps, loop=False):
    """Gerçek hız/yön/dönüş (sağ = +, derece). Döngüde yön ortalama bakışa göre ölçülür."""
    T = root_pos.shape[0]
    dur = max(1e-6, (T - 1) / fps)
    h = unwrap(headings(posed, skeleton))
    k = max(1, min(T // 4, int(0.3 * fps)))
    h0 = h.mean() if loop else h[:k].mean()
    h1 = h.mean() if loop else h[-k:].mean()
    d = root_pos[-1] - root_pos[0]
    dist = float(torch.sqrt(d[0] ** 2 + d[2] ** 2))
    world = math.atan2(float(d[0]), float(d[2]))  # Kimodo yönü
    rel = world - float(h0)
    rel = (rel + math.pi) % (2 * math.pi) - math.pi
    # yol uzunluğu (daireler için ortalama hız)
    step = root_pos[1:, [0, 2]] - root_pos[:-1, [0, 2]]
    path_len = float(torch.linalg.norm(step, dim=1).sum())
    return {
        "seconds": round(dur, 4),
        "distance": round(dist, 4),
        "speed": round(path_len / dur, 4),
        "displacementSpeed": round(dist / dur, 4),
        "direction": round(-math.degrees(rel), 2) if dist > 0.05 else 0.0,
        "turn": round(-math.degrees(float(h1 - h0)), 2),
    }


# --------------------------------------------------------------------------- tek örnek işleme

def process_sample(pos, rot, contacts, skeleton, fps, loop, opts=None):
    """Kimodo çıktısı (posed [T,J,3], global rot [T,J,3,3], temas [T,4]) → (local, kök, posed, motion bilgisi)."""
    local = global_rots_to_local_rots(rot, skeleton)
    root = pos[:, skeleton.root_idx, :]
    opts = opts or {}
    info = {}
    if loop and contacts is not None and pos.shape[0] > int(1.2 * fps):
        a, b, cost = find_loop(pos, root, contacts, skeleton, fps, min_s=float(opts.get("loop_min", 0.55)), max_s=float(opts.get("loop_max", 2.6)))
        local, root, pos = canonicalize(local, root, pos, skeleton, a, mean_heading(pos, skeleton, a, b))
        keep = None
        if opts.get("loop_keep_turn"):
            h = unwrap(headings(pos, skeleton))
            keep = float(h[b] - h[a])
        local, root = close_loop(local, root, a, b, skeleton.root_idx, keep)
        contacts = contacts[a:b + 1]
        _, pos, _ = skeleton.fk(local, root)
        info = {"start": int(a), "end": int(b), "cost": round(float(cost), 6), "sourceFrames": int(rot.shape[0])}
    motion = {
        "measured": measure(root, pos, skeleton, fps, loop=bool(info)),
        "markers": markers(contacts, fps, bool(info)) if contacts is not None else {"L": [], "R": []},
        "poses": {"first": pose_at(local, root, pos, skeleton, 0), "last": pose_at(local, root, pos, skeleton, int(pos.shape[0]) - 1)},
        "loop": info or None,
        "frames": int(pos.shape[0]),
        "fps": fps,
    }
    return local, root, pos, motion
