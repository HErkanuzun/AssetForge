# AssetForge Roadmap

AssetForge follows [Semantic Versioning](https://semver.org): `MAJOR.MINOR.PATCH`.

- **0.x.y** = pre-release. Every `0.MINOR` is a milestone below; `PATCH` releases are bug fixes.
- **1.0.0** = first stable release. The project file format and the MCP tool API are frozen, and later breaking changes need a new MAJOR version.
- Tags look like `v0.4.0`. Pushing a tag builds the Windows installer on GitHub Actions and publishes it as a GitHub Release.

## Where we are: v0.4.1 (alpha), November 2026

About **40 %** of the way to 1.0. The core pipeline works end to end, but some parts are untested with live services and the UI is Turkish only.

| Area | Status |
|---|---|
| Node pipeline editor, runner, QA retry loop | ✅ Done |
| Meshy, ElevenLabs, ComfyUI, Blender, UE5 import | ✅ Done |
| Brief chat, production kits, project bible, spreadsheet import | ✅ Done |
| Producer agent, multi-LLM providers, MCP server and client | ✅ Done |
| Animation systems (Blend Space, Montage, Aim Offset, State Machine, Motion Matching) | ✅ Built and verified in UE 5.8 |
| Kimodo text-to-motion | 🟡 Pipeline tested with sample data; live generation not verified yet |
| English UI | ❌ Not started |
| Automated tests, code signing, auto-update | ❌ Not started |

## Milestones (estimated)

The dates are estimates for one main developer and can move.

| Version | Target | Goal |
|---|---|---|
| **0.4.0** | Nov 2026 | First public alpha: installer, docs in 4 languages, non-commercial license |
| **0.5.0** | Dec 2026 | Live Kimodo verified end to end. Animation fixes, first-run setup wizard, better error messages |
| **0.6.0** | Jan 2027 | Internationalization: English UI (Turkish kept), language switch in Settings |
| **0.7.0** | Feb 2027 | Quality: unit tests for the pipeline and animation math, CI checks, crash and log reporting |
| **0.8.0** | Mar 2027 | Content: vehicle rig tier 3 (suspension, brakes), Niagara templates for VFX sprites, more pipeline templates |
| **0.9.0** | Apr 2027 | Beta: auto-update, signed installer, stable project file format, documentation site |
| **1.0.0** | May 2027 | Stable release: frozen project format and MCP API, upgrade path from 0.x projects |
| 1.x | after 1.0 | Native Unreal Editor plugin, more AI providers, Linux/macOS research |

Estimated time to 1.0: **about 6 months** from v0.4.0.

## How to release (maintainers)

```bash
npm run release:patch   # 0.4.0 -> 0.4.1  bug fixes
npm run release:minor   # 0.4.1 -> 0.5.0  new milestone
git push --follow-tags  # GitHub Actions builds the installer and publishes the release
```

Before tagging, add the changes to [CHANGELOG.md](CHANGELOG.md).
