# Security policy

## Supported versions

AssetForge is in alpha. Security fixes go into the **latest release** only. Please update before reporting.

| Version | Supported |
|---|---|
| Latest 0.x release | ✅ |
| Older releases | ❌ |

## Reporting a vulnerability

**Do not open a public issue.** Report privately through GitHub:

1. Go to <https://github.com/HErkanuzun/AssetForge/security/advisories/new>.
2. Describe the problem, the affected version, and the steps to reproduce it. A proof of concept helps.

If that form is not available, contact the maintainer privately through the contact details on <https://github.com/HErkanuzun> and ask for a private channel. Do not put details in public places.

What to expect: this is a one-person project, so responses are best effort. The goal is to acknowledge a report within 7 days, agree on a fix and disclosure date with you, and credit you in the release notes if you want.

## Security design

What AssetForge protects, so you can judge whether something is a vulnerability:

- **API keys** (Claude, Meshy, ElevenLabs, Hugging Face, other providers) are encrypted with Windows DPAPI through Electron `safeStorage` and stored in the user profile, never in project files.
- **Quick connect** reads the clipboard only after you click "Connect", only for up to 10 minutes, and only keeps text that looks like that service's key and passes a live check with the service. The clipboard is cleared after a key is saved. The OpenRouter sign-in uses OAuth with PKCE and a `state` check on a temporary `127.0.0.1` callback.
- **MCP server** (Settings → MCP) listens on `127.0.0.1` only, checks the `Host` header against DNS rebinding, and requires a secret token. Its tools can create assets, start paid jobs and **run Python inside the Unreal Editor**, so treat the token like a password and regenerate it if it leaks.
- **External MCP servers** you add run as local commands with your user rights. Only add servers you trust. Tool calls ask for approval unless you turn on "run without approval".
- **Producer agent:** actions that spend service credits or cannot be undone ask for confirmation first.
- **Local services** (Unreal Remote Execution, ComfyUI, Kimodo) are reached over the local machine or your local network. Do not expose them to the internet.

Out of scope: problems that need an attacker who already controls your Windows account, and issues in third-party services (report those to the service).
