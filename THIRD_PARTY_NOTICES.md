# Third-party notices

AssetForge is licensed under the [GNU AGPL-3.0](LICENSE) (see also [COMMERCIAL.md](COMMERCIAL.md)). It talks to AI services and local tools that have their own licenses and terms, and it ships open-source npm packages.

**The AGPL covers AssetForge's code, not the assets you make with it.** What you may do with generated models, textures, sounds and animations depends on the terms of the service or model that produced them. Check them before commercial use.

## AI services (online, your own account)

AssetForge calls these with **your** API keys. Your use, and the ownership and allowed use of their output, are governed by each provider's terms.

| Service | Used for | Terms |
|---|---|---|
| Anthropic Claude | Prompt engine, brief chat, vision QA, Producer agent | [Commercial Terms](https://www.anthropic.com/legal/commercial-terms) |
| Meshy | Text/image to 3D, retexture, rigging | [Terms of Use](https://www.meshy.ai/terms-of-use) |
| ElevenLabs | Sound effects, engine audio | [Terms of Use](https://elevenlabs.io/terms-of-use) |
| OpenRouter (optional) | Other LLMs | [Terms](https://openrouter.ai/terms) |

## Models and tools (run on your machine, downloaded by you)

AssetForge does not include these. Its setup steps download them from their official sources, and their licenses apply.

| Component | Used for | License |
|---|---|---|
| NVIDIA Kimodo (code) | Text to motion | Apache-2.0 — [nv-tlabs/kimodo](https://github.com/nv-tlabs/kimodo) |
| Kimodo-SOMA-RP-v1.2 (default model weights) | Text to motion | [NVIDIA Open Model License](https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-open-model-license/) (commercial use allowed). Other Kimodo checkpoints may use other NVIDIA licenses: check the model card before switching. |
| Meta Llama 3 8B Instruct | Kimodo's text encoder | [Meta Llama 3 Community License](https://www.llama.com/llama3/license/) (accepted on Hugging Face) |
| Blender | Cleanup, LODs, retargeting (headless) | GPL-2.0-or-later. AssetForge's Blender scripts (`resources/python`) are AGPL-3.0, which is compatible. |
| ComfyUI | Textures and images (HTTP API) | GPL-3.0 |
| Unreal Engine 5 | Import and animation systems (Python Remote Execution) | [Unreal Engine EULA](https://www.unrealengine.com/eula) |

Product names are trademarks of their owners. AssetForge is not affiliated with or endorsed by them.

## Electron and Chromium

The Windows app is built on [Electron](https://www.electronjs.org/) (MIT), which includes Chromium and other components. Their licenses ship with the app as `LICENSE.electron.txt` and `LICENSES.chromium.html` in the installation folder.

## npm packages shipped with the app

Generated from `package-lock.json` by `node scripts/third-party-notices.mjs`. Each package's full license text is included in its folder under `resources/app.asar` in the installation.

125 packages: MIT (103), ISC (15), BSD-3-Clause (3), Apache-2.0 (2), Unlicense (1), BSD-2-Clause (1).

| Package | Version | License |
|---|---|---|
| [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript) | 1.3.0 | Apache-2.0 |
| [@babel/runtime](https://github.com/babel/babel) | 7.29.10 | MIT |
| [@hono/node-server](https://github.com/honojs/node-server) | 2.1.5 | MIT |
| [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) | 1.32.2 | MIT |
| [@opentelemetry/api](https://github.com/open-telemetry/opentelemetry-js) | 1.10.0 | Apache-2.0 |
| [@stablelib/base64](https://github.com/StableLib/stablelib) | 1.0.1 | MIT |
| [@types/d3-color](https://github.com/DefinitelyTyped/DefinitelyTyped) | 3.1.3 | MIT |
| [@types/d3-drag](https://github.com/DefinitelyTyped/DefinitelyTyped) | 3.0.7 | MIT |
| [@types/d3-interpolate](https://github.com/DefinitelyTyped/DefinitelyTyped) | 3.0.4 | MIT |
| [@types/d3-selection](https://github.com/DefinitelyTyped/DefinitelyTyped) | 3.0.12 | MIT |
| [@types/d3-transition](https://github.com/DefinitelyTyped/DefinitelyTyped) | 3.0.9 | MIT |
| [@types/d3-zoom](https://github.com/DefinitelyTyped/DefinitelyTyped) | 3.0.9 | MIT |
| [@xyflow/react](https://github.com/xyflow/xyflow) | 12.12.0 | MIT |
| [@xyflow/system](https://github.com/xyflow/xyflow) | 0.0.83 | MIT |
| [accepts](https://github.com/jshttp/accepts) | 2.0.0 | MIT |
| [ajv](https://github.com/ajv-validator/ajv) | 8.20.0 | MIT |
| [ajv-formats](https://github.com/ajv-validator/ajv-formats) | 3.0.1 | MIT |
| [body-parser](https://github.com/expressjs/body-parser) | 2.4.0 | MIT |
| [bytes](https://github.com/visionmedia/bytes.js) | 3.1.2 | MIT |
| [call-bind-apply-helpers](https://github.com/ljharb/call-bind-apply-helpers) | 1.0.2 | MIT |
| [call-bound](https://github.com/ljharb/call-bound) | 1.0.4 | MIT |
| [classcat](https://github.com/jorgebucaran/classcat) | 5.0.5 | MIT |
| [content-disposition](https://github.com/jshttp/content-disposition) | 2.0.1 | MIT |
| [content-type](https://github.com/jshttp/content-type) | 1.0.5 | MIT |
| [content-type](https://github.com/jshttp/content-type) | 2.1.0 | MIT |
| [cookie](https://github.com/jshttp/cookie) | 0.7.2 | MIT |
| [cookie-signature](https://github.com/visionmedia/node-cookie-signature) | 1.2.2 | MIT |
| [cors](https://github.com/expressjs/cors) | 2.8.6 | MIT |
| [cross-spawn](git@github.com:moxystudio/node-cross-spawn) | 7.0.6 | MIT |
| [d3-color](https://github.com/d3/d3-color) | 3.1.0 | ISC |
| [d3-dispatch](https://github.com/d3/d3-dispatch) | 3.0.1 | ISC |
| [d3-drag](https://github.com/d3/d3-drag) | 3.0.0 | ISC |
| [d3-ease](https://github.com/d3/d3-ease) | 3.0.1 | BSD-3-Clause |
| [d3-interpolate](https://github.com/d3/d3-interpolate) | 3.0.1 | ISC |
| [d3-selection](https://github.com/d3/d3-selection) | 3.0.0 | ISC |
| [d3-timer](https://github.com/d3/d3-timer) | 3.0.1 | ISC |
| [d3-transition](https://github.com/d3/d3-transition) | 3.0.1 | ISC |
| [d3-zoom](https://github.com/d3/d3-zoom) | 3.0.0 | ISC |
| [debug](https://github.com/debug-js/debug) | 4.4.3 | MIT |
| [depd](https://github.com/dougwilson/nodejs-depd) | 2.0.0 | MIT |
| [dunder-proto](https://github.com/es-shims/dunder-proto) | 1.0.1 | MIT |
| [ee-first](https://github.com/jonathanong/ee-first) | 1.1.1 | MIT |
| [encodeurl](https://github.com/pillarjs/encodeurl) | 2.0.1 | MIT |
| [es-define-property](https://github.com/ljharb/es-define-property) | 1.0.1 | MIT |
| [es-errors](https://github.com/ljharb/es-errors) | 1.3.0 | MIT |
| [es-object-atoms](https://github.com/ljharb/es-object-atoms) | 1.1.2 | MIT |
| [escape-html](https://github.com/component/escape-html) | 1.0.3 | MIT |
| [etag](https://github.com/jshttp/etag) | 1.8.1 | MIT |
| [eventsource](https://git@github.com/EventSource/eventsource) | 3.0.7 | MIT |
| [eventsource-parser](ssh://git@github.com/rexxars/eventsource-parser) | 3.1.1 | MIT |
| [express](https://github.com/expressjs/express) | 5.3.0 | MIT |
| [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) | 8.7.2 | MIT |
| [fast-deep-equal](https://github.com/epoberezkin/fast-deep-equal) | 3.1.3 | MIT |
| [fast-sha256](https://github.com/dchest/fast-sha256-js) | 1.3.0 | Unlicense |
| [fast-uri](https://github.com/fastify/fast-uri) | 3.1.9 | BSD-3-Clause |
| [fflate](https://github.com/101arrowz/fflate) | 0.8.3 | MIT |
| [finalhandler](https://github.com/pillarjs/finalhandler) | 2.1.1 | MIT |
| [forwarded](https://github.com/jshttp/forwarded) | 0.2.0 | MIT |
| [fresh](https://github.com/jshttp/fresh) | 2.0.0 | MIT |
| [function-bind](https://github.com/Raynos/function-bind) | 1.1.2 | MIT |
| [get-intrinsic](https://github.com/ljharb/get-intrinsic) | 1.3.0 | MIT |
| [get-proto](https://github.com/ljharb/get-proto) | 1.0.1 | MIT |
| [gopd](https://github.com/ljharb/gopd) | 1.2.0 | MIT |
| [has-symbols](https://github.com/inspect-js/has-symbols) | 1.1.0 | MIT |
| [hasown](https://github.com/inspect-js/hasOwn) | 2.0.4 | MIT |
| [hono](https://github.com/honojs/hono) | 4.13.16 | MIT |
| [http-errors](https://github.com/jshttp/http-errors) | 2.0.1 | MIT |
| [iconv-lite](https://github.com/pillarjs/iconv-lite) | 0.7.3 | MIT |
| [inherits](https://github.com/isaacs/inherits) | 2.0.4 | ISC |
| [ip-address](https://github.com/beaugunderson/ip-address) | 10.7.5 | MIT |
| [ipaddr.js](https://github.com/whitequark/ipaddr.js) | 1.9.1 | MIT |
| [is-promise](https://github.com/then/is-promise) | 4.0.0 | MIT |
| [isexe](https://github.com/isaacs/isexe) | 2.0.0 | ISC |
| [jose](https://github.com/panva/jose) | 6.2.14 | MIT |
| [json-schema-to-ts](https://github.com/ThomasAribart/json-schema-to-ts) | 3.1.1 | MIT |
| [json-schema-traverse](https://github.com/epoberezkin/json-schema-traverse) | 1.0.0 | MIT |
| [json-schema-typed](https://github.com/RemyRylan/json-schema-typed) | 8.0.2 | BSD-2-Clause |
| [math-intrinsics](https://github.com/es-shims/math-intrinsics) | 1.1.0 | MIT |
| [media-typer](https://github.com/jshttp/media-typer) | 1.1.1 | MIT |
| [merge-descriptors](https://github.com/sindresorhus/merge-descriptors) | 2.0.0 | MIT |
| [mime-db](https://github.com/jshttp/mime-db) | 1.54.0 | MIT |
| [mime-types](https://github.com/jshttp/mime-types) | 3.0.2 | MIT |
| [ms](https://github.com/vercel/ms) | 2.1.3 | MIT |
| [negotiator](https://github.com/jshttp/negotiator) | 1.1.0 | MIT |
| [object-assign](https://github.com/sindresorhus/object-assign) | 4.1.1 | MIT |
| [object-inspect](https://github.com/inspect-js/object-inspect) | 1.13.4 | MIT |
| [on-finished](https://github.com/jshttp/on-finished) | 2.4.2 | MIT |
| [once](https://github.com/isaacs/once) | 1.4.0 | ISC |
| [parseurl](https://github.com/pillarjs/parseurl) | 1.3.3 | MIT |
| [path-key](https://github.com/sindresorhus/path-key) | 3.1.1 | MIT |
| [path-to-regexp](https://github.com/pillarjs/path-to-regexp) | 8.4.2 | MIT |
| [pkce-challenge](https://github.com/crouchcd/pkce-challenge) | 5.0.1 | MIT |
| [proxy-addr](https://github.com/jshttp/proxy-addr) | 2.0.8 | MIT |
| [qs](https://github.com/ljharb/qs) | 6.17.1 | BSD-3-Clause |
| [range-parser](https://github.com/jshttp/range-parser) | 1.3.0 | MIT |
| [raw-body](https://github.com/stream-utils/raw-body) | 3.0.2 | MIT |
| [react](https://github.com/react/react) | 19.3.1 | MIT |
| [react-dom](https://github.com/react/react) | 19.3.1 | MIT |
| [require-from-string](https://github.com/floatdrop/require-from-string) | 2.0.2 | MIT |
| [router](https://github.com/pillarjs/router) | 2.2.0 | MIT |
| [safer-buffer](https://github.com/ChALkeR/safer-buffer) | 2.1.2 | MIT |
| [scheduler](https://github.com/react/react) | 0.28.0 | MIT |
| [send](https://github.com/pillarjs/send) | 1.2.1 | MIT |
| [serve-static](https://github.com/expressjs/serve-static) | 2.2.1 | MIT |
| [setprototypeof](https://github.com/wesleytodd/setprototypeof) | 1.2.0 | ISC |
| [shebang-command](https://github.com/kevva/shebang-command) | 2.0.0 | MIT |
| [shebang-regex](https://github.com/sindresorhus/shebang-regex) | 3.0.0 | MIT |
| [side-channel](https://github.com/ljharb/side-channel) | 1.1.1 | MIT |
| [side-channel-list](https://github.com/ljharb/side-channel-list) | 1.0.1 | MIT |
| [side-channel-map](https://github.com/ljharb/side-channel-map) | 1.0.1 | MIT |
| [side-channel-weakmap](https://github.com/ljharb/side-channel-weakmap) | 1.0.2 | MIT |
| [standardwebhooks](https://github.com/standard-webhooks/standard-webhooks) | 1.1.1 | MIT |
| [statuses](https://github.com/jshttp/statuses) | 2.0.2 | MIT |
| [three](https://github.com/mrdoob/three.js) | 0.187.0 | MIT |
| [toidentifier](https://github.com/component/toidentifier) | 1.0.1 | MIT |
| [ts-algebra](https://github.com/ThomasAribart/ts-algebra) | 2.0.0 | MIT |
| [type-is](https://github.com/jshttp/type-is) | 2.1.0 | MIT |
| [unpipe](https://github.com/stream-utils/unpipe) | 1.0.0 | MIT |
| [use-sync-external-store](https://github.com/react/react) | 1.7.0 | MIT |
| [vary](https://github.com/jshttp/vary) | 1.1.2 | MIT |
| [which](https://github.com/isaacs/node-which) | 2.0.2 | ISC |
| [wrappy](https://github.com/npm/wrappy) | 1.0.2 | ISC |
| [zod](https://github.com/colinhacks/zod) | 4.6.7 | MIT |
| [zod-to-json-schema](https://github.com/StefanTerdell/zod-to-json-schema) | 3.25.2 | ISC |
| [zustand](https://github.com/pmndrs/zustand) | 4.5.7 | MIT |
