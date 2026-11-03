# Contributing to AssetForge

Thanks for helping! Bug reports, ideas, documentation, translations and code are all welcome. Issues and pull requests can be written in **English or Turkish**.

## Before you start

- **Bugs:** open an issue with the bug report form. Attach the steps, what you expected, and the AssetForge version (Settings → About).
- **Features:** open an issue first so we can agree on the approach before you write code.
- **Security problems:** do not open a public issue. Follow [SECURITY.md](SECURITY.md).
- Be kind: this project follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Development setup

Requirements: Windows 10/11, Node.js 24, Git. Python 3.11 with `ruff` is only needed if you change the Python scripts.

```bash
git clone https://github.com/HErkanuzun/AssetForge.git
cd AssetForge
npm install
npm run dev      # app with hot reload
npm run check    # typecheck, lint, format check and tests: run this before every pull request
```

Other useful commands:

| Command | What it does |
|---|---|
| `npm test` / `npm run test:watch` | Vitest unit tests in `tests/` |
| `npm run lint` | oxlint on `src/` and `tests/` |
| `npm run format` | Prettier on the whole repository |
| `npm run lint:py` | ruff on the Blender, Unreal and Kimodo Python scripts |
| `npm run notices` | Regenerates `THIRD_PARTY_NOTICES.md` — run it after adding, removing or updating dependencies (CI checks it) |
| `npm run dist` | Windows installer in `dist/` |

## Code guidelines

- **TypeScript everywhere** in `src/`. Shared types live in `src/shared/types.ts`.
- **Keep logic testable.** Pure functions (math, graph, parsing) go in modules without Electron imports and get tests in `tests/`. In tests, `electron` is replaced by `tests/stubs/electron.ts`.
- **New AI service:** add a node definition in `src/shared/nodes.ts` and an executor in `src/main/engine/executors.ts`. The template tests check that every built-in pipeline still connects valid ports.
- **Python scripts** in `resources/python` run inside Blender or the Unreal Editor (Python 3.11). Do not add third-party packages there.
- **License header:** every source file starts with `SPDX-License-Identifier: AGPL-3.0-only` (a test checks this).
- **UI text** is Turkish for now; English UI is planned (see [ROADMAP.md](ROADMAP.md)).

## Pull requests

1. Fork, create a branch from `main`, and keep the change focused on one thing.
2. Add or update tests for logic changes.
3. Add a line under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md).
4. Run `npm run check`.
5. Open the pull request and tick the CLA box in the template.

### Contributor License Agreement

AssetForge is dual-licensed (AGPL-3.0 and commercial, see [COMMERCIAL.md](COMMERCIAL.md)). To make that possible, contributions are accepted under the [Contributor License Agreement](CLA.md). You keep the copyright in your work. The pull request template has a checkbox for it.

## Releases (maintainers)

```bash
npm version 0.4.3 -m "Release v%s"   # updates READMEs, ROADMAP, llms.txt and CHANGELOG, commits and tags
git push origin main v0.4.3          # CI builds the installer and publishes the release with the CHANGELOG notes
```
