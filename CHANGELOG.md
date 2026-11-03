# Changelog

All notable changes to AssetForge are listed here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org). See [ROADMAP.md](ROADMAP.md) for planned versions.

## [Unreleased]

## [0.4.6] - 2026-11-03

### Added
- **Animation quality check:** the Quality Check node now reads the generated BVH and measures foot sliding, feet sinking into the floor, jitter and single-frame pops, plus how closely the clip matches the requested speed, direction, turn angle and loop seam. Idle and aim clips must stay in place. Thresholds were tuned on NVIDIA Kimodo's own demo motions. Runs locally, no service cost.
- **Audio quality check:** for WAV output it measures silence, clipping, loudness, silence at the start, length against the requested duration, and for loops the seam (clicks and level jumps). Engine sound sets are judged by their weakest file.
- **Automatic retry for animation:** when a clip fails the check, Kimodo generates it again with a different seed and with the fix added to the motion text (for example "feet stay planted on the ground"). Sound effects get the fix through the prompt engine as before.
- The animation, sound effect and engine sound templates now include a Quality Check step (animation retries up to 2 times, sounds once). New projects get them automatically; existing pipelines can add the node by hand.
- Animation Studio shows a **Quality score** chip on each clip, with the problems in its tooltip and the measurements next to the existing ones.

### Fixed
- The Quality Check node gave animation and audio results a 10/10 pass without looking at them. They are now measured, and a bad result sends feedback for a retry.

## [0.4.5] - 2026-11-03

### Added
- **New installer design** in AssetForge's colors: a dark welcome and finish page with the logo and the app's orange gradient, a dark header strip on every page, and its own uninstaller artwork. The installer follows the Windows language (Turkish or English).
- **Setup options page:** choose whether to add a desktop shortcut (the Start menu entry is always added and shows up in Windows search). The page explains how to pin AssetForge to the taskbar; Windows does not let installers pin apps by themselves.
- **Taskbar integration:** right-clicking the pinned icon offers Workshop, Library, Animation Studio, Jobs and Settings, and opens that page directly (also when the app is already open). While pipelines run, the taskbar icon shows their overall progress (red when a job fails) and flashes when a job finishes in the background.
- Uninstalling asks whether to also delete settings, encrypted API keys and logs (default: keep them). Projects and generated assets are never deleted.
- **Version archive:** `versions/` keeps every release in its own folder with its installer, source code zip and release notes, so you can go back to any version. `npm run versions -- --download` fills it from GitHub Releases, and `npm run dist` archives each new build. See [versions/README.md](versions/README.md).
- `npm run installer:art` regenerates the installer images from `scripts/installer-art/art.html`.

## [0.4.4] - 2026-11-03

### Security
- The app window now runs in Chromium's sandbox, with a stricter Content Security Policy (no remote images, scripts or connections; no plugins, frames or forms). The app cannot be navigated away from its own page, cannot open other windows or embed web views, and denies camera, microphone, location and notification requests. Links open in the browser only when they are `https` or local.
- Opening files from the interface is limited to the project folder; programs and scripts (`.exe`, `.bat`, `.ps1`, `.lnk` …) are shown in Explorer instead of being run. The preview protocol's folder check no longer accepts sibling folders with the same name prefix.
- The installed app turns on Electron fuses: no `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS` or inspector flags, code is loaded only from `app.asar`, and the archive's integrity is checked at startup.
- MCP server: the token is compared in constant time, request bodies are limited to 8 MB, and request text is decoded correctly when a multi-byte character is split across chunks.
- No known vulnerabilities left in shipped dependencies: `exceljs` and its old `archiver` / `minimatch` / `uuid` chain (9 moderate advisories) are replaced by a small built-in .xlsx reader. CI now runs `npm audit` on shipped packages. The app ships 125 npm packages instead of 288.

### Added
- Log file at `%APPDATA%\AssetForge\logs\main.log` (rotated at 2 MB). It records errors from the app and the interface, crashed or unresponsive windows and failed child processes. API keys, tokens, OAuth codes and your user name are masked.
- Settings → About → **Problem report**: "Tanılama dosyası kaydet" saves a diagnostics file to attach to a GitHub issue (versions, Windows, CPU, RAM, GPU, a settings summary without key values, Kimodo setup state and the latest log lines). "Günlük klasörünü aç" opens the log folder. The bug report form asks for this file.
- Only one AssetForge window runs at a time; opening it again brings the existing window to the front instead of starting a second copy that fights over the MCP port and settings file.

### Fixed
- Images pasted or dropped into the Brief and Producer chats now show their previews (the old Content Security Policy blocked `blob:` images).
- CSV import handles quoted fields with commas, semicolons, line breaks and `""` escapes, and detects the separator from the header row.
- Old `.xls` files get a clear message asking to save as `.xlsx`.
- Settings are saved atomically, so a crash while saving cannot leave a broken `settings.json`. If the file is ever unreadable, it is backed up as `settings.broken-<time>.json` instead of being silently replaced, so keys and paths can be recovered.

### Changed
- Updated three.js to 0.187, Vitest to 5, and the GitHub Actions to checkout v7, setup-node v7, setup-python v7 and action-gh-release v3.

## [0.4.3] - 2026-11-03

### Changed
- **License: AssetForge is now free and open-source software under the GNU AGPL-3.0** (`AGPL-3.0-only`), with a commercial license available for closed-source use of the code ([COMMERCIAL.md](COMMERCIAL.md)). Everyone, including studios, can use the app and its generated assets commercially. Versions up to 0.4.2 remain under the PolyForm Noncommercial License 1.0.0.
- Every source file carries an `SPDX-License-Identifier` header, checked by a test.
- The installer shows the AGPL-3.0 and installs `LICENSE.txt` and `THIRD_PARTY_NOTICES.md` next to the app. Settings → About links to the license, third-party notices and commercial license.

### Added
- `THIRD_PARTY_NOTICES.md`: terms of the AI services (Claude, Meshy, ElevenLabs, OpenRouter), licenses of the local models and tools (NVIDIA Kimodo and its model weights, Meta Llama 3, Blender, ComfyUI, Unreal Engine) and the 288 npm packages shipped with the app. It is generated from `package-lock.json` (`npm run notices`) and CI fails if it is out of date.
- Contributor docs: `CONTRIBUTING.md`, `CLA.md` (contributor license agreement for dual licensing), `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1) and `SECURITY.md` (private reporting and the app's security design).
- GitHub issue forms for bugs and feature requests (English / Turkish), a pull request template with the CLA checkbox, and Dependabot for npm and GitHub Actions.

## [0.4.2] - 2026-11-03

### Added
- Automated tests (Vitest, 92 tests): pipeline graph ordering and cycle detection, integrity of every built-in pipeline template (node types, ports, port types, required inputs), animation system catalogs and production order, Kimodo root paths (direction, speed, turns, stops, pivots), request building, WAV headers, image sniffing and quick-connect key detection.
- `npm run check` runs typecheck, lint, format check and tests in one go; CI and the release workflow run the same checks, plus `ruff` for the Blender / Unreal / Kimodo Python scripts.
- Code style is enforced: oxlint, Prettier, `.editorconfig` and `.gitattributes` (LF line endings).

### Fixed
- Error messages from Claude, OpenAI-compatible providers and pipeline nodes now keep the original error as `cause`, so logs show the real reason.
- Removed unused imports and dead code in the Python scripts and the assistant.

## [0.4.1] - 2026-11-03

### Added
- Quick connect in Settings: one click opens each service's sign-in / API key page (Claude, Meshy, ElevenLabs, Hugging Face). The copied key is picked up from the clipboard, verified against the service and stored encrypted; the clipboard is then cleared.
- OpenRouter sign-in: "Giriş yap ve bağlan" runs OpenRouter's OAuth (PKCE) flow, so you only approve in the browser and the provider is added with its key automatically.

### Changed
- Settings is split into categories (Accounts & API, AI models, Project, Local tools, Animation, Unreal Engine, MCP, About) with a searchable side menu. It remembers the last category and opens Accounts & API first when a key is missing.
- GitHub release notes now come from the matching CHANGELOG.md section, and `npm version` updates the version in the READMEs, ROADMAP and llms.txt automatically.

## [0.4.0] - 2026-11-02

First public alpha.

### Added
- Animation systems: Sequence, Anim Montage, Blend Space 1D/2D, jump state machine, Aim Offset and Motion Matching (26-clip dance card, Pose Search Schema and Database built automatically in UE5).
- Kimodo constraints: frame-by-frame root path and pose matching between neighbouring clips.
- Seamless loop extraction from foot contacts, measured speed/direction/turn, L/R sync markers.
- Version number shown in Settings.
- Release workflow: pushing a `v*` tag builds the Windows installer and publishes a GitHub Release.
- README in English, Turkish, Spanish and Simplified Chinese, plus ROADMAP and CHANGELOG.

### Changed
- License: PolyForm Noncommercial 1.0.0 (free for personal and educational use, no commercial use).
- Generic defaults for everyone: Kimodo models go to the app data folder by default, and examples no longer use personal paths.

### Fixed
- The `FORGE_PROJECT_DIR` development override is no longer written to the saved settings.

## [0.3.0] - 2026-11-01

### Added
- Producer agent (Ctrl+J) with 20 tools and confirmation for paid or irreversible actions.
- Provider layer: Claude, any OpenAI-compatible or Anthropic-compatible endpoint, with a model per role.
- MCP server (`http://127.0.0.1:9560/mcp`) and MCP client for external servers.

## [0.2.0] - 2026-11-01

### Added
- Launcher-style UI: Workshop, Library, Animation Studio.
- Brief chat with an AI director and production kits.
- NVIDIA Kimodo text-to-motion with native Windows and WSL2 backends, BVH preview, Manny bone naming and UE retargeting.
- Dynamic engine sound (ElevenLabs RPM layers into a MetaSound).

## [0.1.0] - 2026-11-01

### Added
- Node-based pipeline editor, runner and QA retry loop.
- Meshy, ElevenLabs, ComfyUI, Blender and Unreal Engine 5 integrations.
- Project bible, spreadsheet import and the prompt engine.

[Unreleased]: https://github.com/HErkanuzun/AssetForge/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/HErkanuzun/AssetForge/releases/tag/v0.4.0
