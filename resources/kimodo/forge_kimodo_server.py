# SPDX-License-Identifier: AGPL-3.0-only
# AssetForge — NVIDIA Kimodo için kalıcı üretim servisi (Docker konteyneri içinde çalışır).
# Model bir kez yüklenir; AssetForge HTTP ile hareket ister, BVH metni olarak geri alır.
#
#   GET  /health    → {"ok": true, "model": ..., "fps": 30, "device": "cuda:0", "busy": false}
#   POST /generate  → {"texts": ["A person walks forward."], "durations": [4.0], "seed": 1,
#                      "steps": 100, "num_samples": 1, "transition_frames": 5, "postprocess": true,
#                      "cfg_weight": null,
#                      "loop": false,                      # true → en temiz döngüyü kes, dikişi kapat
#                      "loop_min": 0.55, "loop_max": 2.6, "loop_keep_turn": false, "first_heading": 0,
#                      "constraints": [                    # isteğe bağlı (kareler tüm zaman çizgisine göre)
#                        {"type": "path", "points": [[x, z], ...], "headings": [derece, sağ=+]},
#                        {"type": "pose", "frame": 0 | -1, "pose": {...motion.poses.last}, "x": 0, "z": 0, "heading": 0},
#                        {...Kimodo JSON kısıtı (root2d / fullbody / left-foot ...)}
#                      ]}
#                   ← {"bvh": ["HIERARCHY ..."], "fps": 30, "frames": [120], "seconds": 12.3,
#                      "motion": [{"measured": {...}, "markers": {"L": [sn], "R": [sn]}, "poses": {"first": ..., "last": ...}, "loop": {...}}]}
#
# Kimodo kodu Apache-2.0, model ağırlıkları NVIDIA Open Model License kapsamındadır.

import argparse
import json
import os
import tempfile
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import torch

import forge_motion as fm
from kimodo import load_model
from kimodo.constraints import load_constraints_lst
from kimodo.exports.bvh import save_motion_bvh
from kimodo.skeleton import SOMASkeleton30
from kimodo.tools import seed_everything

ap = argparse.ArgumentParser()
ap.add_argument("--port", type=int, default=9551)
ap.add_argument("--model", default=os.environ.get("FORGE_KIMODO_MODEL", "Kimodo-SOMA-RP-v1.2"))
args = ap.parse_args()

DEVICE = "cuda:0" if torch.cuda.is_available() else "cpu"
print(f"[forge] model yükleniyor: {args.model} ({DEVICE})", flush=True)
MODEL, RESOLVED = load_model(args.model, device=DEVICE, default_family="Kimodo", return_resolved_name=True)
print(f"[forge] hazır: {RESOLVED} @ {MODEL.fps} fps", flush=True)
try:
    import motion_correction  # noqa: F401 — ayak kayması düzeltme (C++), isteğe bağlı
    HAS_POSTPROCESS = True
except Exception:  # noqa: BLE001
    HAS_POSTPROCESS = False
    print("[forge] MotionCorrection yok: son işleme kapalı", flush=True)
LOCK = threading.Lock()
BUSY = {"v": False}


def build_constraints(req, total):
    raw = []
    for c in req.get("constraints") or []:
        t = c.get("type")
        if t == "pose":
            frame = int(c.get("frame", 0))
            if frame < 0:
                frame = total + frame
            raw.append(fm.pose_constraint(c["pose"], max(0, min(total - 1, frame)), c.get("x", 0.0), c.get("z", 0.0), c.get("heading", 0.0)))
        elif t == "path":
            pts = c["points"][:total]
            hd = c.get("headings")
            raw.append(fm.path_constraint(pts, hd[: len(pts)] if hd else None))
        else:
            raw.append(c)
    return load_constraints_lst(raw, MODEL.skeleton, device=DEVICE) if raw else []


def generate(req):
    texts = [t.strip() for t in req["texts"] if t.strip()]
    if not texts:
        raise ValueError("boş prompt")
    durations = req.get("durations") or [4.0]
    if len(durations) == 1 and len(texts) > 1:
        durations = durations * len(texts)
    num_frames = [max(8, int(float(d) * MODEL.fps)) for d in durations]
    if req.get("seed") is not None:
        seed_everything(int(req["seed"]))
    kwargs = {}
    if req.get("cfg_weight") is not None:
        kwargs["cfg_weight"] = req["cfg_weight"]
    if req.get("first_heading") is not None:
        kwargs["first_heading_angle"] = -float(req["first_heading"]) * 3.141592653589793 / 180.0
    out = MODEL(
        texts,
        num_frames,
        constraint_lst=build_constraints(req, sum(num_frames)),
        num_denoising_steps=int(req.get("steps", 100)),
        num_samples=int(req.get("num_samples", 1)),
        multi_prompt=True,
        num_transition_frames=int(req.get("transition_frames", 5)),
        post_processing=bool(req.get("postprocess", True)) and HAS_POSTPROCESS,
        return_numpy=True,
        **kwargs,
    )
    skeleton = MODEL.skeleton
    if isinstance(skeleton, SOMASkeleton30):
        skeleton = skeleton.somaskel77.to(DEVICE)
    loop = bool(req.get("loop"))
    fps = MODEL.fps
    bvhs, frames, motions = [], [], []
    for i in range(int(out["posed_joints"].shape[0])):
        pos = torch.from_numpy(out["posed_joints"][i]).to(DEVICE).float()
        rot = torch.from_numpy(out["global_rot_mats"][i]).to(DEVICE).float()
        contacts = out["foot_contacts"][i] if "foot_contacts" in out else None
        local, root, pos, motion = fm.process_sample(pos, rot, contacts, skeleton, fps, loop, req)
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "clip.bvh")
            save_motion_bvh(path, local, root, skeleton=skeleton, fps=fps, standard_tpose=True)
            with open(path, encoding="utf-8") as fh:
                bvhs.append(fh.read())
        frames.append(int(pos.shape[0]))
        motions.append(motion)
    return {"bvh": bvhs, "fps": fps, "frames": frames, "motion": motions}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):  # noqa: N802
        if self.path.startswith("/health"):
            self._send(200, {"ok": True, "model": RESOLVED, "fps": MODEL.fps, "device": DEVICE, "busy": BUSY["v"], "postprocess": HAS_POSTPROCESS})
        else:
            self._send(404, {"error": "yok"})

    def do_POST(self):  # noqa: N802
        if not self.path.startswith("/generate"):
            return self._send(404, {"error": "yok"})
        try:
            req = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))) or b"{}")
            with LOCK:
                BUSY["v"] = True
                t0 = time.time()
                try:
                    res = generate(req)
                finally:
                    BUSY["v"] = False
            res["seconds"] = round(time.time() - t0, 2)
            self._send(200, res)
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            self._send(500, {"error": str(e)})

    def log_message(self, fmt, *a):
        print("[forge] " + fmt % a, flush=True)


ThreadingHTTPServer(("0.0.0.0", args.port), Handler).serve_forever()
