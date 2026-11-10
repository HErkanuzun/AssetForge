# SPDX-License-Identifier: AGPL-3.0-only
# AssetForge — hangi asset yollarının var olduğunu döndürür. MANIFEST = {"paths": ["/Game/..."]}
import json

import unreal

M = MANIFEST  # noqa: F821 — AssetForge üstte ekler
print("FORGE_RESULT " + json.dumps({"exists": [p for p in M.get("paths", []) if unreal.EditorAssetLibrary.does_asset_exist(p)]}))
