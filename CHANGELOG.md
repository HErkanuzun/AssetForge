# Changelog

All notable changes to AssetForge are listed here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org). See [ROADMAP.md](ROADMAP.md) for planned versions.

## [Unreleased]

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
