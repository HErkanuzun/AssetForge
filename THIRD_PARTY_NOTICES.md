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

288 packages: MIT (245), ISC (25), BSD-3-Clause (6), Apache-2.0 (5), Unlicense (2), not declared (1), MIT/X11 (1), BSD-2-Clause (1), (MIT OR GPL-3.0-or-later) (1), (MIT AND Zlib) (1).

| Package | Version | License |
|---|---|---|
| [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript) | 1.3.0 | Apache-2.0 |
| [@babel/runtime](https://github.com/babel/babel) | 7.29.10 | MIT |
| [@dimforge/rapier3d-compat](https://github.com/dimforge/rapier.js) | 0.12.0 | Apache-2.0 |
| [@fast-csv/format](https://github.com/C2FO/fast-csv) | 4.3.5 | MIT |
| [@fast-csv/parse](https://github.com/C2FO/fast-csv) | 4.3.6 | MIT |
| [@hono/node-server](https://github.com/honojs/node-server) | 2.1.5 | MIT |
| [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) | 1.32.2 | MIT |
| [@opentelemetry/api](https://github.com/open-telemetry/opentelemetry-js) | 1.10.0 | Apache-2.0 |
| [@stablelib/base64](https://github.com/StableLib/stablelib) | 1.0.1 | MIT |
| [@tweenjs/tween.js](https://github.com/tweenjs/tween.js) | 23.1.3 | MIT |
| [@types/d3-color](https://github.com/DefinitelyTyped/DefinitelyTyped) | 3.1.3 | MIT |
| [@types/d3-drag](https://github.com/DefinitelyTyped/DefinitelyTyped) | 3.0.7 | MIT |
| [@types/d3-interpolate](https://github.com/DefinitelyTyped/DefinitelyTyped) | 3.0.4 | MIT |
| [@types/d3-selection](https://github.com/DefinitelyTyped/DefinitelyTyped) | 3.0.12 | MIT |
| [@types/d3-transition](https://github.com/DefinitelyTyped/DefinitelyTyped) | 3.0.9 | MIT |
| [@types/d3-zoom](https://github.com/DefinitelyTyped/DefinitelyTyped) | 3.0.9 | MIT |
| [@types/node](https://github.com/DefinitelyTyped/DefinitelyTyped) | 14.18.63 | MIT |
| [@types/stats.js](https://github.com/DefinitelyTyped/DefinitelyTyped) | 0.17.4 | MIT |
| [@types/three](https://github.com/DefinitelyTyped/DefinitelyTyped) | 0.181.0 | MIT |
| [@types/webxr](https://github.com/DefinitelyTyped/DefinitelyTyped) | 0.5.24 | MIT |
| [@webgpu/types](https://github.com/gpuweb/types) | 0.1.74 | BSD-3-Clause |
| [@xyflow/react](https://github.com/xyflow/xyflow) | 12.12.0 | MIT |
| [@xyflow/system](https://github.com/xyflow/xyflow) | 0.0.83 | MIT |
| [accepts](https://github.com/jshttp/accepts) | 2.0.0 | MIT |
| [ajv](https://github.com/ajv-validator/ajv) | 8.20.0 | MIT |
| [ajv-formats](https://github.com/ajv-validator/ajv-formats) | 3.0.1 | MIT |
| [archiver](https://github.com/archiverjs/node-archiver) | 5.3.2 | MIT |
| [archiver-utils](https://github.com/archiverjs/archiver-utils) | 2.1.0 | MIT |
| [archiver-utils](https://github.com/archiverjs/archiver-utils) | 3.0.4 | MIT |
| [array-buffer-byte-length](https://github.com/inspect-js/array-buffer-byte-length) | 1.0.2 | MIT |
| [arraybuffer.prototype.slice](https://github.com/es-shims/ArrayBuffer.prototype.slice) | 1.0.4 | MIT |
| [async](https://github.com/caolan/async) | 3.2.6 | MIT |
| [async-function](https://github.com/ljharb/async-function) | 1.0.0 | MIT |
| [available-typed-arrays](https://github.com/inspect-js/available-typed-arrays) | 1.0.7 | MIT |
| [balanced-match](https://github.com/juliangruber/balanced-match) | 1.0.2 | MIT |
| [base64-js](https://github.com/beatgammit/base64-js) | 1.5.1 | MIT |
| [big-integer](git@github.com:peterolson/BigInteger.js) | 1.6.52 | Unlicense |
| [binary](http://github.com/substack/node-binary) | 0.3.0 | MIT |
| [bl](https://github.com/rvagg/bl) | 4.1.0 | MIT |
| [bluebird](https://github.com/petkaantonov/bluebird) | 3.4.7 | MIT |
| [body-parser](https://github.com/expressjs/body-parser) | 2.4.0 | MIT |
| [brace-expansion](https://github.com/juliangruber/brace-expansion) | 1.1.21 | MIT |
| [brace-expansion](https://github.com/juliangruber/brace-expansion) | 2.1.7 | MIT |
| [buffer](https://github.com/feross/buffer) | 5.7.1 | MIT |
| [buffer-crc32](https://github.com/brianloveswords/buffer-crc32) | 0.2.13 | MIT |
| [buffer-indexof-polyfill](https://github.com/sarosia/buffer-indexof-polyfill) | 1.0.2 | MIT |
| [buffers](http://github.com/substack/node-buffers) | 0.1.1 | not declared |
| [bytes](https://github.com/visionmedia/bytes.js) | 3.1.2 | MIT |
| [call-bind](https://github.com/ljharb/call-bind) | 1.0.9 | MIT |
| [call-bind-apply-helpers](https://github.com/ljharb/call-bind-apply-helpers) | 1.0.2 | MIT |
| [call-bound](https://github.com/ljharb/call-bound) | 1.0.4 | MIT |
| [chainsaw](http://github.com/substack/node-chainsaw) | 0.1.0 | MIT/X11 |
| [classcat](https://github.com/jorgebucaran/classcat) | 5.0.5 | MIT |
| [compress-commons](https://github.com/archiverjs/node-compress-commons) | 4.1.2 | MIT |
| [concat-map](https://github.com/substack/node-concat-map) | 0.0.1 | MIT |
| [content-disposition](https://github.com/jshttp/content-disposition) | 2.0.1 | MIT |
| [content-type](https://github.com/jshttp/content-type) | 1.0.5 | MIT |
| [content-type](https://github.com/jshttp/content-type) | 2.1.0 | MIT |
| [cookie](https://github.com/jshttp/cookie) | 0.7.2 | MIT |
| [cookie-signature](https://github.com/visionmedia/node-cookie-signature) | 1.2.2 | MIT |
| [core-util-is](https://github.com/isaacs/core-util-is) | 1.0.3 | MIT |
| [cors](https://github.com/expressjs/cors) | 2.8.6 | MIT |
| [crc-32](https://github.com/SheetJS/js-crc32) | 1.2.2 | Apache-2.0 |
| [crc32-stream](https://github.com/archiverjs/node-crc32-stream) | 4.0.3 | MIT |
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
| [data-view-buffer](https://github.com/inspect-js/data-view-buffer) | 1.0.2 | MIT |
| [data-view-byte-length](https://github.com/inspect-js/data-view-byte-length) | 1.0.2 | MIT |
| [data-view-byte-offset](https://github.com/inspect-js/data-view-byte-offset) | 1.0.1 | MIT |
| [dayjs](https://github.com/iamkun/dayjs) | 1.11.23 | MIT |
| [debug](https://github.com/debug-js/debug) | 4.4.3 | MIT |
| [define-data-property](https://github.com/ljharb/define-data-property) | 1.1.4 | MIT |
| [define-properties](https://github.com/ljharb/define-properties) | 1.2.1 | MIT |
| [depd](https://github.com/dougwilson/nodejs-depd) | 2.0.0 | MIT |
| [dunder-proto](https://github.com/es-shims/dunder-proto) | 1.0.1 | MIT |
| [duplexer2](https://github.com/deoxxa/duplexer2) | 0.1.4 | BSD-3-Clause |
| [ee-first](https://github.com/jonathanong/ee-first) | 1.1.1 | MIT |
| [encodeurl](https://github.com/pillarjs/encodeurl) | 2.0.1 | MIT |
| [end-of-stream](https://github.com/mafintosh/end-of-stream) | 1.4.5 | MIT |
| [es-abstract](https://github.com/ljharb/es-abstract) | 1.24.2 | MIT |
| [es-abstract-get](https://github.com/ljharb/es-abstract-get) | 1.0.0 | MIT |
| [es-define-property](https://github.com/ljharb/es-define-property) | 1.0.1 | MIT |
| [es-errors](https://github.com/ljharb/es-errors) | 1.3.0 | MIT |
| [es-object-atoms](https://github.com/ljharb/es-object-atoms) | 1.1.2 | MIT |
| [es-set-tostringtag](https://github.com/es-shims/es-set-tostringtag) | 2.1.0 | MIT |
| [es-to-primitive](https://github.com/ljharb/es-to-primitive) | 1.3.4 | MIT |
| [escape-html](https://github.com/component/escape-html) | 1.0.3 | MIT |
| [etag](https://github.com/jshttp/etag) | 1.8.1 | MIT |
| [eventsource](https://git@github.com/EventSource/eventsource) | 3.0.7 | MIT |
| [eventsource-parser](ssh://git@github.com/rexxars/eventsource-parser) | 3.1.1 | MIT |
| [exceljs](https://github.com/exceljs/exceljs) | 4.4.0 | MIT |
| [express](https://github.com/expressjs/express) | 5.3.0 | MIT |
| [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) | 8.7.2 | MIT |
| [fast-csv](https://github.com/C2FO/fast-csv) | 4.3.6 | MIT |
| [fast-deep-equal](https://github.com/epoberezkin/fast-deep-equal) | 3.1.3 | MIT |
| [fast-sha256](https://github.com/dchest/fast-sha256-js) | 1.3.0 | Unlicense |
| [fast-uri](https://github.com/fastify/fast-uri) | 3.1.9 | BSD-3-Clause |
| [fflate](https://github.com/101arrowz/fflate) | 0.8.3 | MIT |
| [finalhandler](https://github.com/pillarjs/finalhandler) | 2.1.1 | MIT |
| [for-each](https://github.com/Raynos/for-each) | 0.3.5 | MIT |
| [forwarded](https://github.com/jshttp/forwarded) | 0.2.0 | MIT |
| [fresh](https://github.com/jshttp/fresh) | 2.0.0 | MIT |
| [fs-constants](https://github.com/mafintosh/fs-constants) | 1.0.0 | MIT |
| [fs.realpath](https://github.com/isaacs/fs.realpath) | 1.0.0 | ISC |
| [fstream](https://github.com/npm/fstream) | 1.0.12 | ISC |
| [function-bind](https://github.com/Raynos/function-bind) | 1.1.2 | MIT |
| [function.prototype.name](https://github.com/es-shims/Function.prototype.name) | 1.2.0 | MIT |
| [functions-have-names](https://github.com/inspect-js/functions-have-names) | 1.2.3 | MIT |
| [generator-function](https://github.com/TimothyGu/generator-function) | 2.0.1 | MIT |
| [get-intrinsic](https://github.com/ljharb/get-intrinsic) | 1.3.0 | MIT |
| [get-proto](https://github.com/ljharb/get-proto) | 1.0.1 | MIT |
| [get-symbol-description](https://github.com/inspect-js/get-symbol-description) | 1.1.0 | MIT |
| [glob](https://github.com/isaacs/node-glob) | 7.2.3 | ISC |
| [globalthis](https://github.com/ljharb/System.global) | 1.0.4 | MIT |
| [gopd](https://github.com/ljharb/gopd) | 1.2.0 | MIT |
| [graceful-fs](https://github.com/isaacs/node-graceful-fs) | 4.2.11 | ISC |
| [has-bigints](https://github.com/ljharb/has-bigints) | 1.1.0 | MIT |
| [has-property-descriptors](https://github.com/inspect-js/has-property-descriptors) | 1.0.2 | MIT |
| [has-proto](https://github.com/inspect-js/has-proto) | 1.2.0 | MIT |
| [has-symbols](https://github.com/inspect-js/has-symbols) | 1.1.0 | MIT |
| [has-tostringtag](https://github.com/inspect-js/has-tostringtag) | 1.0.2 | MIT |
| [hasown](https://github.com/inspect-js/hasOwn) | 2.0.4 | MIT |
| [hono](https://github.com/honojs/hono) | 4.13.16 | MIT |
| [http-errors](https://github.com/jshttp/http-errors) | 2.0.1 | MIT |
| [iconv-lite](https://github.com/pillarjs/iconv-lite) | 0.7.3 | MIT |
| [ieee754](https://github.com/feross/ieee754) | 1.2.1 | BSD-3-Clause |
| [immediate](https://github.com/calvinmetcalf/immediate) | 3.0.6 | MIT |
| [inflight](https://github.com/npm/inflight) | 1.0.6 | ISC |
| [inherits](https://github.com/isaacs/inherits) | 2.0.4 | ISC |
| [internal-slot](https://github.com/ljharb/internal-slot) | 1.1.0 | MIT |
| [ip-address](https://github.com/beaugunderson/ip-address) | 10.7.5 | MIT |
| [ipaddr.js](https://github.com/whitequark/ipaddr.js) | 1.9.1 | MIT |
| [is-array-buffer](https://github.com/inspect-js/is-array-buffer) | 3.0.5 | MIT |
| [is-async-function](https://github.com/inspect-js/is-async-function) | 2.1.1 | MIT |
| [is-bigint](https://github.com/inspect-js/is-bigint) | 1.1.0 | MIT |
| [is-boolean-object](https://github.com/inspect-js/is-boolean-object) | 1.2.2 | MIT |
| [is-callable](https://github.com/inspect-js/is-callable) | 1.2.7 | MIT |
| [is-data-view](https://github.com/inspect-js/is-data-view) | 1.0.2 | MIT |
| [is-date-object](https://github.com/inspect-js/is-date-object) | 1.1.0 | MIT |
| [is-document.all](https://github.com/inspect-js/is-document.all) | 1.0.0 | MIT |
| [is-finalizationregistry](https://github.com/inspect-js/is-finalizationregistry) | 1.1.1 | MIT |
| [is-generator-function](https://github.com/inspect-js/is-generator-function) | 1.1.2 | MIT |
| [is-map](https://github.com/inspect-js/is-map) | 2.0.3 | MIT |
| [is-negative-zero](https://github.com/inspect-js/is-negative-zero) | 2.0.3 | MIT |
| [is-number-object](https://github.com/inspect-js/is-number-object) | 1.1.1 | MIT |
| [is-promise](https://github.com/then/is-promise) | 4.0.0 | MIT |
| [is-regex](https://github.com/inspect-js/is-regex) | 1.2.1 | MIT |
| [is-set](https://github.com/inspect-js/is-set) | 2.0.3 | MIT |
| [is-shared-array-buffer](https://github.com/inspect-js/is-shared-array-buffer) | 1.0.4 | MIT |
| [is-string](https://github.com/inspect-js/is-string) | 1.1.1 | MIT |
| [is-symbol](https://github.com/inspect-js/is-symbol) | 1.1.1 | MIT |
| [is-typed-array](https://github.com/inspect-js/is-typed-array) | 1.1.15 | MIT |
| [is-weakmap](https://github.com/inspect-js/is-weakmap) | 2.0.2 | MIT |
| [is-weakref](https://github.com/inspect-js/is-weakref) | 1.1.1 | MIT |
| [is-weakset](https://github.com/inspect-js/is-weakset) | 2.0.4 | MIT |
| [isarray](https://github.com/juliangruber/isarray) | 1.0.0 | MIT |
| [isarray](https://github.com/juliangruber/isarray) | 2.0.5 | MIT |
| [isexe](https://github.com/isaacs/isexe) | 2.0.0 | ISC |
| [jose](https://github.com/panva/jose) | 6.2.14 | MIT |
| [json-schema-to-ts](https://github.com/ThomasAribart/json-schema-to-ts) | 3.1.1 | MIT |
| [json-schema-traverse](https://github.com/epoberezkin/json-schema-traverse) | 1.0.0 | MIT |
| [json-schema-typed](https://github.com/RemyRylan/json-schema-typed) | 8.0.2 | BSD-2-Clause |
| [jszip](https://github.com/Stuk/jszip) | 3.10.2 | (MIT OR GPL-3.0-or-later) |
| [lazystream](https://github.com/jpommerening/node-lazystream) | 1.0.1 | MIT |
| [lie](https://github.com/calvinmetcalf/lie) | 3.3.0 | MIT |
| [listenercount](git@github.com:jden/node-listenercount) | 1.0.1 | ISC |
| [lodash.defaults](https://github.com/lodash/lodash) | 4.2.0 | MIT |
| [lodash.difference](https://github.com/lodash/lodash) | 4.5.0 | MIT |
| [lodash.escaperegexp](https://github.com/lodash/lodash) | 4.1.2 | MIT |
| [lodash.flatten](https://github.com/lodash/lodash) | 4.4.0 | MIT |
| [lodash.groupby](https://github.com/lodash/lodash) | 4.6.0 | MIT |
| [lodash.isboolean](https://github.com/lodash/lodash) | 3.0.3 | MIT |
| [lodash.isequal](https://github.com/lodash/lodash) | 4.5.0 | MIT |
| [lodash.isfunction](https://github.com/lodash/lodash) | 3.0.9 | MIT |
| [lodash.isnil](https://github.com/lodash/lodash) | 4.0.0 | MIT |
| [lodash.isplainobject](https://github.com/lodash/lodash) | 4.0.6 | MIT |
| [lodash.isundefined](https://github.com/lodash/lodash) | 3.0.1 | MIT |
| [lodash.union](https://github.com/lodash/lodash) | 4.6.0 | MIT |
| [lodash.uniq](https://github.com/lodash/lodash) | 4.5.0 | MIT |
| [math-intrinsics](https://github.com/es-shims/math-intrinsics) | 1.1.0 | MIT |
| [media-typer](https://github.com/jshttp/media-typer) | 1.1.1 | MIT |
| [merge-descriptors](https://github.com/sindresorhus/merge-descriptors) | 2.0.0 | MIT |
| [meshoptimizer](https://github.com/zeux/meshoptimizer) | 0.22.0 | MIT |
| [mime-db](https://github.com/jshttp/mime-db) | 1.54.0 | MIT |
| [mime-types](https://github.com/jshttp/mime-types) | 3.0.2 | MIT |
| [minimatch](https://github.com/isaacs/minimatch) | 3.1.5 | ISC |
| [minimatch](https://github.com/isaacs/minimatch) | 5.1.9 | ISC |
| [minimist](https://github.com/minimistjs/minimist) | 1.2.8 | MIT |
| [mkdirp](https://github.com/substack/node-mkdirp) | 0.5.6 | MIT |
| [ms](https://github.com/vercel/ms) | 2.1.3 | MIT |
| [negotiator](https://github.com/jshttp/negotiator) | 1.1.0 | MIT |
| [normalize-path](https://github.com/jonschlinkert/normalize-path) | 3.0.0 | MIT |
| [object-assign](https://github.com/sindresorhus/object-assign) | 4.1.1 | MIT |
| [object-inspect](https://github.com/inspect-js/object-inspect) | 1.13.4 | MIT |
| [object-keys](https://github.com/ljharb/object-keys) | 1.1.1 | MIT |
| [object.assign](https://github.com/ljharb/object.assign) | 4.1.7 | MIT |
| [on-finished](https://github.com/jshttp/on-finished) | 2.4.2 | MIT |
| [once](https://github.com/isaacs/once) | 1.4.0 | ISC |
| [own-keys](https://github.com/ljharb/own-keys) | 1.0.2 | MIT |
| [pako](https://github.com/nodeca/pako) | 1.0.11 | (MIT AND Zlib) |
| [parseurl](https://github.com/pillarjs/parseurl) | 1.3.3 | MIT |
| [path-is-absolute](https://github.com/sindresorhus/path-is-absolute) | 1.0.1 | MIT |
| [path-key](https://github.com/sindresorhus/path-key) | 3.1.1 | MIT |
| [path-to-regexp](https://github.com/pillarjs/path-to-regexp) | 8.4.2 | MIT |
| [pkce-challenge](https://github.com/crouchcd/pkce-challenge) | 5.0.1 | MIT |
| [possible-typed-array-names](https://github.com/ljharb/possible-typed-array-names) | 1.1.0 | MIT |
| [process-nextick-args](https://github.com/calvinmetcalf/process-nextick-args) | 2.0.1 | MIT |
| [proxy-addr](https://github.com/jshttp/proxy-addr) | 2.0.8 | MIT |
| [qs](https://github.com/ljharb/qs) | 6.17.1 | BSD-3-Clause |
| [range-parser](https://github.com/jshttp/range-parser) | 1.3.0 | MIT |
| [raw-body](https://github.com/stream-utils/raw-body) | 3.0.2 | MIT |
| [react](https://github.com/react/react) | 19.3.1 | MIT |
| [react-dom](https://github.com/react/react) | 19.3.1 | MIT |
| [readable-stream](https://github.com/nodejs/readable-stream) | 2.3.8 | MIT |
| [readable-stream](https://github.com/nodejs/readable-stream) | 3.6.2 | MIT |
| [readdir-glob](https://github.com/Yqnn/node-readdir-glob) | 1.1.3 | Apache-2.0 |
| [reflect.getprototypeof](https://github.com/es-shims/Reflect.getPrototypeOf) | 1.0.10 | MIT |
| [regexp.prototype.flags](https://github.com/es-shims/RegExp.prototype.flags) | 1.5.4 | MIT |
| [require-from-string](https://github.com/floatdrop/require-from-string) | 2.0.2 | MIT |
| [rimraf](https://github.com/isaacs/rimraf) | 2.7.1 | ISC |
| [router](https://github.com/pillarjs/router) | 2.2.0 | MIT |
| [safe-array-concat](https://github.com/ljharb/safe-array-concat) | 1.1.4 | MIT |
| [safe-buffer](https://github.com/feross/safe-buffer) | 5.1.2 | MIT |
| [safe-buffer](https://github.com/feross/safe-buffer) | 5.2.1 | MIT |
| [safe-push-apply](https://github.com/ljharb/safe-push-apply) | 1.0.0 | MIT |
| [safe-regex-test](https://github.com/ljharb/safe-regex-test) | 1.1.0 | MIT |
| [safer-buffer](https://github.com/ChALkeR/safer-buffer) | 2.1.2 | MIT |
| [saxes](https://github.com/lddubeau/saxes) | 5.0.1 | ISC |
| [scheduler](https://github.com/react/react) | 0.28.0 | MIT |
| [send](https://github.com/pillarjs/send) | 1.2.1 | MIT |
| [serve-static](https://github.com/expressjs/serve-static) | 2.2.1 | MIT |
| [set-function-length](https://github.com/ljharb/set-function-length) | 1.2.2 | MIT |
| [set-function-name](https://github.com/ljharb/set-function-name) | 2.0.2 | MIT |
| [set-proto](https://github.com/ljharb/set-proto) | 1.0.0 | MIT |
| [setimmediate](https://github.com/YuzuJS/setImmediate) | 1.0.5 | MIT |
| [setprototypeof](https://github.com/wesleytodd/setprototypeof) | 1.2.0 | ISC |
| [shebang-command](https://github.com/kevva/shebang-command) | 2.0.0 | MIT |
| [shebang-regex](https://github.com/sindresorhus/shebang-regex) | 3.0.0 | MIT |
| [side-channel](https://github.com/ljharb/side-channel) | 1.1.1 | MIT |
| [side-channel-list](https://github.com/ljharb/side-channel-list) | 1.0.1 | MIT |
| [side-channel-map](https://github.com/ljharb/side-channel-map) | 1.0.1 | MIT |
| [side-channel-weakmap](https://github.com/ljharb/side-channel-weakmap) | 1.0.2 | MIT |
| [standardwebhooks](https://github.com/standard-webhooks/standard-webhooks) | 1.1.1 | MIT |
| [statuses](https://github.com/jshttp/statuses) | 2.0.2 | MIT |
| [stop-iteration-iterator](https://github.com/ljharb/stop-iteration-iterator) | 1.1.0 | MIT |
| [string_decoder](https://github.com/nodejs/string_decoder) | 1.1.1 | MIT |
| [string_decoder](https://github.com/nodejs/string_decoder) | 1.3.0 | MIT |
| [string.prototype.trim](https://github.com/es-shims/String.prototype.trim) | 1.2.11 | MIT |
| [string.prototype.trimend](https://github.com/es-shims/String.prototype.trimEnd) | 1.0.10 | MIT |
| [string.prototype.trimstart](https://github.com/es-shims/String.prototype.trimStart) | 1.0.8 | MIT |
| [tar-stream](https://github.com/mafintosh/tar-stream) | 2.2.0 | MIT |
| [three](https://github.com/mrdoob/three.js) | 0.181.0 | MIT |
| [tmp](https://github.com/raszi/node-tmp) | 0.2.7 | MIT |
| [toidentifier](https://github.com/component/toidentifier) | 1.0.1 | MIT |
| [traverse](https://github.com/ljharb/js-traverse) | 0.3.10 | MIT |
| [ts-algebra](https://github.com/ThomasAribart/ts-algebra) | 2.0.0 | MIT |
| [type-is](https://github.com/jshttp/type-is) | 2.1.0 | MIT |
| [typed-array-buffer](https://github.com/inspect-js/typed-array-buffer) | 1.0.3 | MIT |
| [typed-array-byte-length](https://github.com/inspect-js/typed-array-byte-length) | 1.0.3 | MIT |
| [typed-array-byte-offset](https://github.com/inspect-js/typed-array-byte-offset) | 1.0.5 | MIT |
| [typed-array-length](https://github.com/inspect-js/typed-array-length) | 1.0.8 | MIT |
| [typedarray.prototype.slice](https://github.com/es-shims/TypedArray.prototype.slice) | 1.0.6 | MIT |
| [unbox-primitive](https://github.com/ljharb/unbox-primitive) | 1.1.0 | MIT |
| [unpipe](https://github.com/stream-utils/unpipe) | 1.0.0 | MIT |
| [unzipper](https://github.com/ZJONSSON/node-unzipper) | 0.10.14 | MIT |
| [use-sync-external-store](https://github.com/react/react) | 1.7.0 | MIT |
| [util-deprecate](https://github.com/TooTallNate/util-deprecate) | 1.0.2 | MIT |
| [uuid](https://github.com/uuidjs/uuid) | 8.3.2 | MIT |
| [vary](https://github.com/jshttp/vary) | 1.1.2 | MIT |
| [which](https://github.com/isaacs/node-which) | 2.0.2 | ISC |
| [which-boxed-primitive](https://github.com/inspect-js/which-boxed-primitive) | 1.1.1 | MIT |
| [which-builtin-type](https://github.com/inspect-js/which-builtin-type) | 1.2.1 | MIT |
| [which-collection](https://github.com/inspect-js/which-collection) | 1.0.2 | MIT |
| [which-typed-array](https://github.com/inspect-js/which-typed-array) | 1.1.24 | MIT |
| [wrappy](https://github.com/npm/wrappy) | 1.0.2 | ISC |
| [xmlchars](https://github.com/lddubeau/xmlchars) | 2.2.0 | MIT |
| [zip-stream](https://github.com/archiverjs/node-zip-stream) | 4.1.1 | MIT |
| [zod](https://github.com/colinhacks/zod) | 4.6.7 | MIT |
| [zod-to-json-schema](https://github.com/StefanTerdell/zod-to-json-schema) | 3.25.2 | ISC |
| [zustand](https://github.com/pmndrs/zustand) | 4.5.7 | MIT |

Packages without a declared license (kept as transitive dependencies of the packages above; their authors are credited here): `buffers`.
