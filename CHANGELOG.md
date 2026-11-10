# Changelog

All notable changes to AssetForge are listed here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org). See [ROADMAP.md](ROADMAP.md) for planned versions.

## [Unreleased]

### Added
- **Several ComfyUI servers:** Settings → Local tools → ComfyUI now holds a list of servers: this PC, other PCs on your network, or a rented GPU.
  - Change a server's name and address right in its row, test it, turn it on or off, and open its node editor.
  - Servers behind a password can take a token. It is stored encrypted and sent as `Authorization: Bearer`.
  - "Bu bilgisayarda ara" finds ComfyUI running on this PC (ports 8188, 8000, 8189, 8190, 8001) and adds it with one click.
  - Your old single address moves into the list on its own.
- **ComfyUI workflow library:** add API-format workflows from a file, by drag and drop, or by pasting the JSON.
  - AssetForge keeps its own copy, so moving the original file breaks nothing.
  - Each workflow shows what it makes (image, 3D, sound, motion) and which inputs AssetForge can fill.
  - Rename, replace with a new export, duplicate, show in folder, delete, and pick a default.
  - A workflow saved in ComfyUI's normal format is turned away with a note on how to export the API version.
  - Your old default workflow file moves into the library on its own.
- **Choosing where a workflow runs:** ComfyUI nodes now pick the workflow from the library and the server from a list: "Otomatik" or a specific server. A workflow can also have its own preferred server.
  - "Otomatik" skips servers that are off or missing a node or model the workflow needs, then picks the one with the shortest queue. Jobs that start at the same time spread across free servers.
  - The job log says which server was used and why the others were skipped.
  - "Sunucularda denetle" in the library shows, for each server, which nodes and models are missing.
- **OpenAI-compatible image and voice steps:** the image and sound jobs that ComfyUI can do now also have an OpenAI-compatible option. They work with OpenAI and with local or hosted servers that follow the same API, such as LocalAI, Kokoro TTS or a gateway.
  - "Görsel (OpenAI uyumlu)" makes images from text, or edits a reference image.
  - "Ses Satırı (TTS)" turns a line of dialogue into speech: pick the voice, speed, format and delivery notes.
  - Both use the OpenAI-compatible entries in Settings → AI models; new presets are OpenAI, Kokoro TTS and LocalAI.
  - New template: "Ses Satırı — Replik + TTS" (the AI writes the line, TTS speaks it, quality check, Unreal import).
- **Generic HTTP step** ("HTTP İsteği"): connect any generation service with an HTTP API without waiting for a built-in node.
  - Fill the request with the prompt, seed, image, audio or model (as a path, base64 or data URI).
  - Pick the result from the response (a URL, base64 or the raw file), and poll jobs that finish later.
  - The API key is only sent to the service's own address.
- **Web server: use AssetForge from a browser and share it with your team** (Settings → "Web ve paylaşım"). The browser shows the same app with the same project and jobs, and changes appear for everyone at once.
  - Accounts with roles. The owner can do everything. An editor can edit and start generation, but can't touch Settings, keys, installs or Unreal Python. A viewer can only look.
  - Invite links with a role, an expiry time and a number of uses. Passwords are stored as salted hashes.
  - When two people save at the same time, their changes are merged instead of overwriting each other.
  - Files dropped or picked in the browser are uploaded into the project folder. Editors can't make the app read files outside the project folder.
  - Server-only mode: close the window and keep serving from the tray icon, start with `--headless`, or choose "Açılışta pencere açılmasın".
  - By default it is reachable only from this PC. Turn on "Yerel ağa aç" for your network; Settings explains Tailscale and Cloudflare Tunnel for access from outside.
- **Gradio app node** ("Gradio Uygulaması"): runs any Gradio app through its API. That covers a demo installed from a git repo, an app opened by Pinokio, an app on another PC, or a Hugging Face Space.
  - AssetForge's inputs (prompt, negative, seed, duration, image, 3D model, sound) go to the app's fields by type and name. "Sabit değerler (JSON)" sets any other field.
  - Images, 3D models and sounds the app returns go on to the next nodes.
  - Works with Gradio 4 and 5. The saved Hugging Face token is used for Hugging Face Spaces.
- **Custom backends from a git repo:** add an AI project that has no ComfyUI node yet. Settings → Local tools → "Özel arka uçlar ve Gradio uygulamaları":
  - AssetForge downloads the repo and shows an install recipe. The recipe comes from the repo's own `assetforge.json`, or AssetForge drafts one from the repo's files (requirements, start file, Gradio or not).
  - You review and edit the recipe. AssetForge shows every command before anything runs, and installs only after you confirm.
  - Each project gets its own Python environment (uv) and folder. Hugging Face models go to one shared cache on the same disk.
  - AssetForge starts the project in the background when a node needs it, and shows its status, log, endpoints and how inputs will be mapped. You can start, stop, reinstall or remove it.
  - "İncele" shows the endpoints of any running Gradio app.

## [0.5.0] - 2026-11-10

### Added
- **Agent task node** ("Ajan Görevi"): an AI you choose does one pipeline step on its own with the tools you connect, and its files go on to the next nodes as a model, image or sound. Engines:
  - **API:** any LLM from Settings (Claude or an OpenAI-compatible model).
  - **Claude Code** or **Codex CLI:** uses your own subscription; must be installed and logged in.
- **Choosing the agent's tools:** pick which MCP server it uses (for example Blender MCP), or all or none, and optionally let it run terminal commands.
- **Quality-check feedback on agent steps:** when the quality check rejects the result, its feedback goes back to the agent and the step runs again.
- **New template:** "Ajan — Blender MCP ile Model (QA)". The agent builds the model in Blender with moving parts as separate objects and saves a GLB. Then Blender cleanup, quality check and Unreal import run as usual.
- **Local ComfyUI managed by AssetForge:** it installs ComfyUI (Python 3.12, CUDA PyTorch), starts it in the background when a ComfyUI node runs, and shows install and server status in Settings.
- **Assembly and motion rig node** ("Montaj ve Hareket Rigi"): measures the model in Blender, and an AI looks at measured views to cut out moving parts. It places bones at their pivots and adds effect points, dent zones and open/close clips:
  - Moving parts: wheels, doors, hood, trunk, lids, propellers and similar.
  - Effect points: exhaust, lights, dust.
  - Dent zones: morph targets plus a damage mask in the vertex colors.
  - Clips: open/close animations, with kit sounds assigned to them.
  - The AI checks its own result renders and fixes its plan. Engines: API, Claude Code or Codex CLI. You can also give a plan by hand (no AI).
- **Vehicles go into Unreal fully set up:** the Unreal Export node builds a rigged model as a vehicle:
  - Skeletal mesh with dent morph targets, clips, a physics asset and a vehicle Anim Blueprint.
  - A vehicle Blueprint copied from the project's vehicle template, with wheel sizes, doors, seats, lights and exhaust set from the rig.
  - The kit's door, trunk, horn and engine sounds are wired in. Export waits for kit sounds that are still being made.
- **New template:** "Araç — Konsept→3D + Rig → Unreal", now suggested for vehicles. The Brief director gives vehicle sounds standard role tags so they reach the right slot.
- **Engine MetaSound** gets an `RPMAlpha` input (0–1), for vehicles that send only a rev ratio. Games that send `RPM` work as before.
- **Unreal MCP fallback:** when Python Remote Execution is not on, AssetForge reaches the editor through the Unreal MCP server (Settings → Unreal Engine → Unreal MCP address). "Unreal’ı bul" shows both connections.
- **Game design page** ("Oyun Tasarımı"):
  - Core idea, design pillars and mechanics.
  - Gameplay and story loops as editable flowcharts.
  - Story with acts, beats and characters.
  - In-game UI screens with their elements, data bindings and screen flow.
  - Each section can be written or improved by AI (API, Claude Code or Codex).
  - The Brief director and the producer assistant now know the design.
  - Export a GDD in Markdown with mermaid flowcharts.
  - The `get_game_design` MCP tool gives the design to outside agents.
- **Agent CLI check in Settings:** Settings → AI models shows whether Claude Code and Codex CLI are installed, with their version and path, and links to the install page when one is missing. The diagnostics file lists them too. Thanks to the contributor who suggested this in PR #7.
- **Teach the Unreal AI:** sends the game design and AssetForge's asset rules into the Unreal project as Agent Skills, so any AI connected to Unreal follows them. The rules cover folders, naming, vehicle setup, dent targets and import optimization.

### Changed
- Dependency updates: Electron 45.2.3, Anthropic SDK 1.6.0, Vitest 5.1 and others.

### Not yet tested live
- The Unreal parts (vehicle setup in the editor, Unreal MCP fallback, sending Agent Skills) and planning a design with the API engine pass their automated tests but have not been tried in a live Unreal editor yet. Please report anything that goes wrong.

### Fixed
- On the game design page, long loop names no longer push the loop dropdown out of its column.
- The local ComfyUI install no longer stops while downloading ComfyUI. Windows PowerShell treated git's progress messages as errors. A half-finished download is now removed and started again.
- Starting the local ComfyUI no longer waits until ComfyUI is closed again. The background server kept the starter's output open, so a workflow that had to start ComfyUI never began.

## [0.4.8] - 2026-11-06

First step of the new direction: ComfyUI becomes AssetForge's production backend, so one integration opens local models and many paid services. AssetForge stays the producer (brief, project bible, prompts, quality checks, Blender, Unreal import). See [ROADMAP.md](ROADMAP.md).

### Added
- **ComfyUI workflow node** ("ComfyUI İş Akışı"): runs any ComfyUI workflow and passes its results on in the pipeline as images, 3D models, audio or animation. Optional inputs for prompt, image, model and audio; uploaded files go to ComfyUI's input folder (3D models under `3d/`). BVH output is turned into FBX with Blender for Unreal.
- AssetForge values reach the workflow through node titles: `AF:prompt`, `AF:negative`, `AF:seed`, `AF:seconds`, `AF:image`, `AF:model`, `AF:audio`. Without titles, the sampler's positive and negative text and a single Load Image / Load 3D / Load Audio node are found automatically. The old `{{PROMPT}}` placeholders still work. Output nodes titled `AF:anim` (or `AF:model` …) decide the output type; otherwise the file extension does.
- **Comfy account key** (Settings → Local tools → ComfyUI) for partner nodes such as Meshy, Tripo, Rodin, Hunyuan3D and ElevenLabs. Partner nodes are paid with Comfy credits.
- Live progress from ComfyUI while a workflow runs, and a **Test connection** button that shows the ComfyUI version and GPU. The diagnostics file includes whether ComfyUI is reachable.

### Changed
- The ComfyUI image node uses the same runner: clearer errors when a workflow is rejected (which node, which input, and a hint when a custom node is missing), a message when a UI-format file is chosen instead of the API format, seeds that change between quality-check retries, and canceling a job removes it from ComfyUI's queue without stopping other work there.

### Fixed
- The animation quality check no longer fails on clips that have only an FBX file; it notes that the motion could not be measured.

## [0.4.7] - 2026-11-03

### Fixed
- **Quick connect** no longer waits silently when the copied text is not recognized. If what you copied does not look like that service's key (for example a password copied while logging in), the tile says so and shows how the key should start. Keys copied together with other text, such as `MESHY_API_KEY="msy_…"` or with quotes and line breaks, are now found inside it.
- A key that failed only because of a network problem is tried again when you copy it again; before, it was ignored for the rest of the attempt. A key the service rejected now gets a clear message instead of being ignored.
- After a failed check the tile keeps showing that AssetForge is still waiting, instead of offering "Connect" again while the clipboard is still being watched.

### Added
- **"Panodakini dene"** button while quick connect is waiting: checks whatever is in the clipboard right away, even if its format is not recognized.
- Quick connect steps are written to the log file (never the key itself), so a diagnostics file shows where a connection got stuck.

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
