<div align="center">

<img src="build/icon.png" width="96" alt="AssetForge logo" />

# AssetForge — AI Game Asset Pipeline for Unreal Engine 5

**Describe it once. Get a game-ready model, textures, sounds, VFX and synchronized animation systems imported straight into Unreal Engine.**

[![Download for Windows](https://img.shields.io/badge/Download-Windows%20installer-ff6a3d?style=for-the-badge&logo=windows)](https://github.com/HErkanuzun/AssetForge/releases/latest)

[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)
![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-0078d4)
![Unreal Engine](https://img.shields.io/badge/Unreal%20Engine-5.x-313131?logo=unrealengine)
![Electron](https://img.shields.io/badge/Electron-React%20%2B%20TypeScript-47848f?logo=electron)
![MCP](https://img.shields.io/badge/MCP-server%20%2B%20client-8a2be2)
![Version](https://img.shields.io/badge/version-0.6.0%20alpha-orange)

**English** · [Türkçe](README.tr.md) · [Español](README.es.md) · [简体中文](README.zh-CN.md)

<img src="docs/screenshots/workshop.png" alt="AssetForge workshop: describe a game asset and the AI factory produces it" width="900" />

</div>

---

## What is AssetForge?

AssetForge is a free and open-source **desktop app for Windows that turns a short text brief into production-ready game assets for Unreal Engine 5**. It chains AI services into one node-based pipeline:

| Step | Service | Output |
|---|---|---|
| Prompt engine, art direction, vision QA | Claude, or any OpenAI-compatible / local LLM (Ollama, LM Studio, vLLM, OpenRouter) | Service-specific prompts that respect your project's style bible |
| Text / image to 3D, retexture, rigging | Meshy | GLB/FBX meshes, PBR textures, UE5 Manny-compatible rigs |
| Text to motion | NVIDIA Kimodo (local, CUDA) | Looping, root-motion animation clips |
| Sound effects and dynamic engine audio | ElevenLabs | SFX plus RPM layers wired into a MetaSound |
| Images, textures, 3D, audio and motion | ComfyUI (any workflow: local models such as TRELLIS.2 or ACE-Step for free, or partner nodes such as Meshy, Tripo, Rodin and ElevenLabs with a Comfy account) | Textures, sprites, image-to-3D models, music, motion clips |
| Cleanup and LODs | Blender (headless) | Scaled, decimated and renamed FBX with LOD 50/25/10 % |
| Import | Unreal Engine 5 Python Remote Execution | Assets in the right folders, material instances, Blend Spaces, Montages, Pose Search databases |

It is built for indie developers, technical artists and students who want **consistent, project-specific assets** instead of one-off generations.

## Features

- **Director-style brief chat.** Type "a rusty pickup driving through the desert". The AI director asks clickable questions (pace, terrain, style, palette, polygon budget) and builds a **production kit**: the model plus engine sound, door and impact SFX, dust VFX, damage variants and animations. One click sends everything to the queue.
- **Animation systems, not just clips.** Generate complete, synchronized clip sets and build them in Unreal automatically:
  - Single sequence and **Anim Montage** (actions that start and end in the idle pose)
  - **Blend Space 1D** (speed) and **Blend Space 2D** (direction × speed) with measured clip speeds
  - **Jump state machine** (start → loop → land with matched poses)
  - **Aim Offset** (mesh-space additive poses)
  - **Motion Matching** with a 26-clip dance card, a Pose Search Schema (trajectory + feet/pelvis channels) and a Pose Search Database filled automatically
- **Seamless loops.** Loops are cut from left-foot plant to left-foot plant using Kimodo's foot contacts. The seam error is spread across the clip (0.00° measured in Unreal). Real speed, direction and turn rate are measured, and L/R sync markers are added for Blend Space sync.
- **Pose-matched transitions.** Start, stop, turn and pivot clips are generated with their first and last frames locked to the neighbouring clip's pose, using a frame-by-frame root path.
- **Project bible.** Art direction, palette, material library, category rules and technical budgets. It can be filled automatically from your GDD or world-guide PDFs.
- **Quality control loop.** Technical checks (triangles, UVs, size), AI vision review, and local checks for animation (foot sliding, floor penetration, jitter, speed and direction) and audio (silence, clipping, loudness, loop seams). Low scores rewrite the prompt and rerun the pipeline; animation retries with a new seed.
- **Node-based pipeline editor** (React Flow) with ready-made pipelines for characters, vehicles, props, textures, sounds, VFX and animation.
- **Spreadsheet import.** Import your asset list from Excel or CSV. Palette and material sheets go straight into the project bible.
- **"Producer" AI agent (Ctrl+J).** An in-app assistant with 20+ tools: write assets, run pipelines, review previews, generate animations and run Python inside Unreal. Paid or irreversible actions always ask for confirmation.
- **MCP server and client.** AssetForge exposes a token-protected [Model Context Protocol](https://modelcontextprotocol.io) server at `http://127.0.0.1:9560/mcp`, so Claude Code, Claude Desktop or any MCP client can drive your asset pipeline. External MCP servers (Blender MCP, Unreal MCP, filesystem…) can be plugged in as tools.
- **Bring your own model.** Assign different LLMs to the assistant, the prompt engine and vision QA.
- **Any generation backend.** Run steps on ComfyUI (one or more servers on your network), on any OpenAI-compatible image or text-to-speech API, or on any HTTP API through the generic HTTP step.
- **Web server for teams.** Open the same app in a browser and invite people as editors or viewers. Everyone works on one project on one PC, and the app can also run as a server only, with no window.
- **Game-ready characters.** UE5 Manny/Quinn bone naming, LODs, IK Rig and retargeter, and a shared SOMA skeleton with automatic retargeting.

## Screenshots

| Brief chat with the AI director | Asset library |
|---|---|
| ![AI director brief chat generating a game asset production kit](docs/screenshots/brief-chat.png) | ![Game asset library with previews](docs/screenshots/library.png) |
| **Blend Space 2D from measured clip speeds** | **Motion Matching dance card** |
| ![Blend Space 2D direction and speed generated with AI text-to-motion](docs/screenshots/blend-space-2d.png) | ![Motion matching Pose Search clip set generated automatically](docs/screenshots/motion-matching.png) |

## Download and install

1. Download **`AssetForge-Setup-x.y.z.exe`** from the [latest release](https://github.com/HErkanuzun/AssetForge/releases/latest).
2. Run the installer. The build is not code-signed yet, so Windows SmartScreen may warn you: click **More info → Run anyway**. The installer (Turkish or English, following Windows) lets you choose the folder, all users or just you, and whether to add a desktop shortcut. Once AssetForge is pinned to the taskbar, right-click its icon to jump to the Workshop, Library, Animation, Jobs or Settings.
3. Open **Settings** and add the API keys you plan to use. Keys are stored encrypted with Windows DPAPI on your machine.
4. Pick a project folder and start in the **Workshop** ("Ne üretelim?").

> The interface is currently in **Turkish**. English UI is planned for v0.6 (see [ROADMAP.md](ROADMAP.md)), and contributions are welcome.

### Requirements

| Component | Needed for | Notes |
|---|---|---|
| Windows 10/11 x64 | the app | |
| Unreal Engine 5.x | import and build | Enable *Python Editor Script Plugin* and *Project Settings → Python → Enable Remote Execution*. Tested on UE 5.8. |
| Blender 4.x / 5.x | cleanup, LODs, FBX | Detected automatically. Tested on Blender 5.2. |
| Anthropic API key **or** an OpenAI-compatible endpoint | prompts, brief chat, QA, agent | Local models through Ollama or LM Studio work too. |
| Meshy API key | 3D models, textures, rigging | |
| ElevenLabs API key | sound effects, engine audio | |
| Custom backends (optional) | anything with a Gradio demo or HTTP API | Install an AI project from its git repo with an install recipe (`assetforge.json` in the repo, or a draft AssetForge suggests). It gets its own Python environment and starts when a node needs it. The *Gradio app* node also runs apps opened by Pinokio, on another PC, or Hugging Face Spaces. |
| ComfyUI (optional) | images, 3D, audio, motion | Any API-format workflow, kept in a library in Settings. Add several ComfyUI servers (this PC, other PCs on your network, a rented GPU) and let each node pick one or choose automatically. Name the nodes `AF:prompt`, `AF:image`, `AF:model`, `AF:audio`, `AF:seed` (or use `{{PROMPT}}` placeholders). A Comfy account key is needed only for partner nodes. |
| NVIDIA GPU + ~25 GB disk (optional) | Kimodo text-to-motion | One-click setup in the Animation page. Needs a Hugging Face token. |

## Build from source

```bash
git clone https://github.com/HErkanuzun/AssetForge.git
cd AssetForge
npm install
npm run dev     # development with hot reload
npm run dist    # build the Windows installer into dist/ and archive it in versions/
npm run versions -- --download  # fill versions/ with every release (installer, source, notes)
npm run check   # typecheck, lint, format check and tests (same as CI)
```

## How it works

```
Brief / spreadsheet ─▶ Project bible ─▶ Prompt engine ─▶ Meshy · ComfyUI · ElevenLabs · Kimodo
                                                                   │
                         Unreal Engine 5 ◀── Blender cleanup ◀── Vision QA (retry if low score)
```

- `src/main/engine`: pipeline runner (topological order, QA retries, job queue) and node executors
- `src/main/anim`: animation systems (root-path builder, production phases, UE build manifest)
- `resources/kimodo/forge_motion.py`: Kimodo constraints, loop extraction, measurement and sync markers
- `resources/python/ue_animsys.py`: builds Blend Spaces, Aim Offsets, Montages and Pose Search assets in Unreal
- `src/main/agent`: Producer agent, MCP server and MCP client

To add a new AI service, add a node definition in `src/shared/nodes.ts` and an executor in `src/main/engine/executors.ts`.

## FAQ

**Is AssetForge free?**
Yes. It is open source under the AGPL-3.0, free for everyone, including studios making commercial games. The assets you generate are yours to use under the terms of the AI services that made them. A commercial license is only needed to put AssetForge's code into closed-source products (see [License](#license)).

**Can it generate Unreal Engine motion matching data?**
Yes. It generates a full locomotion clip set with NVIDIA Kimodo, then creates a Pose Search Schema and Database in UE5 and adds every clip automatically.

**Does it work without Claude?**
Yes. Any OpenAI-compatible or Anthropic-compatible endpoint works, including fully local LLMs.

**Can I control it from Claude Code or another AI agent?**
Yes. Connect any MCP client to `http://127.0.0.1:9560/mcp` with the token shown in Settings.

**Can my team use it together?**
Yes. Turn on the web server in Settings → "Web ve paylaşım", set an owner password and send invite links. By default it is reachable only from your PC. You can open it to your local network, or use Tailscale or Cloudflare Tunnel for access from outside. On a local network the connection is plain HTTP, so use a tunnel on networks you don't trust.

**Which skeleton do animations use?**
Clips are generated on Kimodo's SOMA skeleton, renamed to UE5 Manny bones with root motion in Blender, and retargeted to your character in Unreal.

## Versions and roadmap

AssetForge uses [Semantic Versioning](https://semver.org). The current version is **0.6.0 (alpha)**, and 1.0 is estimated in about 6 months.

| Version | Target | Goal |
|---|---|---|
| 0.5 | Dec 2026 | Live Kimodo verified end to end, setup wizard |
| 0.6 | Jan 2027 | English UI |
| 0.7 | Feb 2027 | Tests, CI checks, crash reporting |
| 0.8 | Mar 2027 | Vehicle rig tier 3, Niagara VFX templates |
| 0.9 | Apr 2027 | Beta: auto-update, signed installer |
| **1.0** | May 2027 | Stable project format and MCP API |

Full plan: [ROADMAP.md](ROADMAP.md) · Changes: [CHANGELOG.md](CHANGELOG.md)

## Contributing

Bug reports, ideas, translations and pull requests are welcome, in English or Turkish. Start with [CONTRIBUTING.md](CONTRIBUTING.md). Please follow the [Code of Conduct](CODE_OF_CONDUCT.md), and report security problems privately as described in [SECURITY.md](SECURITY.md).

## License

AssetForge is **free and open-source software** under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0-only).

- ✅ Free for everyone: individuals, studios, schools and companies, including commercial game projects
- ✅ The assets you generate are not covered by the AGPL. What you may do with them depends on the AI services and models that produced them (see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md))
- ✅ Modify it and share your changes, as long as you share their source code under the AGPL
- ⚠️ If you offer a modified version to others over a network, you must offer them its source code (AGPL section 13)

**Commercial license:** to use AssetForge's code in a closed-source product or service, or under terms other than the AGPL, see [COMMERCIAL.md](COMMERCIAL.md). Contributions are accepted under the [CLA](CLA.md), see [CONTRIBUTING.md](CONTRIBUTING.md).

Versions up to 0.4.2 were released under the PolyForm Noncommercial License 1.0.0. From 0.4.3 on, AssetForge is AGPL-3.0.

Copyright © 2026 Hasan Erkan Uzun. Unreal Engine, Meshy, ElevenLabs, ComfyUI, Blender, Claude and NVIDIA Kimodo are trademarks of their respective owners. AssetForge is not affiliated with them. Each service is subject to its own terms.

<sub>Keywords: AI game asset generator, Unreal Engine 5 asset pipeline, text to 3D for games, AI animation generator, text to motion, motion matching, blend space generator, Pose Search, game dev tools, procedural asset generation, MCP server for game development.</sub>
