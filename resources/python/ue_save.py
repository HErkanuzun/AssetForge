# SPDX-License-Identifier: AGPL-3.0-only
# AssetForge — verilen asset'leri kaydeder. MANIFEST = {"paths": ["/Game/..."]}
import json

import unreal

M = MANIFEST  # noqa: F821 — AssetForge üstte ekler
out = {"saved": [], "errors": []}
for p in M.get("paths", []):
    try:
        if unreal.EditorAssetLibrary.save_asset(p, False):
            out["saved"].append(p)
        else:
            out["errors"].append("kaydedilemedi: " + p)
    except Exception as e:  # noqa: BLE001
        out["errors"].append("%s: %s" % (p, e))
print("FORGE_RESULT " + json.dumps(out))
