// SPDX-License-Identifier: AGPL-3.0-only
export const nodeDetailRows = {
  'metadata.panel': ['Panel', '面板', 'Panel'],
  'metadata.localTools': ['Blender and ComfyUI', 'Blender 和 ComfyUI', 'Blender ve ComfyUI'],
  'node.detail.animation': ['Animation (BVH/FBX)', '动画（BVH/FBX）', 'Animasyon (BVH/FBX)'],
  'node.detail.autoImport': ['Automatically import into Unreal', '自动导入 Unreal', "Unreal'a otomatik import"],
  'node.detail.ikRetarget': ['IK Rig + Manny retargeting', 'IK Rig 和 Manny 重定向', 'IK Rig + Manny retarget'],
  'node.detail.workflow': ['Workflow', '工作流', 'Workflow'],
  'node.detail.seed': ['Seed', '种子', 'Seed'],
  'node.detail.quad': ['Quads', '四边面', 'Quad'],
  'node.detail.aPose': ['A-pose', 'A 字姿势', 'A-pose'],
  'node.detail.tPose': ['T-pose', 'T 字姿势', 'T-pose'],
  'node.detail.bananaPro': ['Nano Banana Pro (Pro plan)', 'Nano Banana Pro（Pro 套餐）', 'Nano Banana Pro (Pro plan)'],
  'node.detail.hd': ['High definition (dall-e-3)', '高清（dall-e-3）', 'hd (dall-e-3)'],
  'node.detail.standard': ['Standard (dall-e-3)', '标准（dall-e-3）', 'standard (dall-e-3)'],
  'node.word.prompt': ['Prompt', '提示词', 'Prompt'],
  'node.word.remesh': ['Meshy Remesh', 'Meshy 重拓扑', 'Meshy Remesh'],
  'node.word.rig': ['Meshy Rig', 'Meshy 骨骼绑定', 'Meshy Rig'],
  'node.word.export': ['Unreal Export', 'Unreal 导出', 'Unreal Export'],
  'node.asset.input.description': [
    'The asset row selected at run time. Every pipeline starts here.',
    '运行时选择的资源行。每条流水线都从此开始。',
    'Çalıştırırken seçilen asset satırı (asset listesinden). Her hat bununla başlar.'
  ],
  'node.model.file.description': [
    'Loads a model from disk (GLB/FBX/OBJ), such as an earlier Meshy output. {id} is replaced with the asset ID.',
    '从磁盘加载模型（GLB/FBX/OBJ），例如先前生成的 Meshy 模型。{id} 将替换为资源 ID。',
    'Diskteki bir modeli (GLB/FBX/OBJ) hatta sokar — ör. daha önce üretilmiş Meshy çıktıları. {id} yazılırsa asset ID ile değiştirilir.'
  ],
  'node.image.file.description': [
    'Loads a concept/reference image from disk for image-to-3D. {id} is replaced with the asset ID.',
    '从磁盘加载用于图像转 3D 的概念图或参考图。{id} 将替换为资源 ID。',
    'Diskteki konsept/referans görseli hatta sokar (görsel→3D için). {id} asset ID ile değiştirilir.'
  ],
  'node.prompt.generate.description': [
    'Claude writes prompts using the Project Bible, asset information and target service rules. Failed quality checks trigger a rewrite with feedback.',
    'Claude 根据项目设定集、资源信息和目标服务规则编写提示词。质量检查失败后会结合反馈重写。',
    'Claude, Proje Kitabı + asset bilgisi + hedef servisin kurallarıyla prompt yazar. Kalite kontrol başarısız olursa geri bildirimle yeniden yazar.'
  ],
  'node.image.meshy.description': ['Generates concept/reference images with Meshy text-to-image.', '通过 Meshy 文生图生成概念图或参考图。', 'Meshy text-to-image ile konsept/referans görsel üretir.'],
  'node.image.comfyui.description': [
    'Generates images/textures with local ComfyUI API workflows. Local models are free. Use ComfyUI Workflow for other output types.',
    '使用本机 ComfyUI API 工作流生成图像或纹理。本机模型免费；其他输出类型请使用 ComfyUI 工作流节点。',
    'Bilgisayarındaki ComfyUI ile (API formatı workflow) görsel/doku üretir. Ücretsiz, yerel. Görselden başka çıktılar için “ComfyUI İş Akışı” düğümünü kullanın.'
  ],
  'node.comfy.workflow.description': [
    'Runs any ComfyUI workflow and passes images, 3D models, audio or animation to the pipeline. Local models are free; partner nodes use Comfy credits. Title input nodes AF:prompt, AF:image, AF:model, AF:audio and AF:seed.',
    '运行任意 ComfyUI 工作流，将图像、3D 模型、音频或动画传入流水线。本机模型免费，合作节点使用 Comfy 积分。请将输入节点命名为 AF:prompt、AF:image、AF:model、AF:audio 和 AF:seed。',
    'Herhangi bir ComfyUI workflow’unu çalıştırır ve çıktısını (görsel, 3D model, ses, animasyon) hatta verir. Yerel modeller ücretsizdir; Meshy, Tripo, Rodin, Hunyuan3D, ElevenLabs gibi partner düğümleri Comfy hesabı kredisiyle çalışır. Girişlerin gideceği düğümlerin başlığını AF:prompt, AF:image, AF:model, AF:audio, AF:seed yapın.'
  ],
  'node.image.openai.description': [
    'Generates images through OpenAI compatible endpoints (/images/generations or /images/edits when an image is connected). Add the provider in Settings → AI models.',
    '通过兼容 OpenAI 的端点生成图像（/images/generations，连接图像后使用 /images/edits）。请在设置 → AI 模型中添加提供商。',
    'OpenAI uyumlu bir görsel ucuyla (/images/generations; görsel bağlıysa /images/edits) görsel üretir: OpenAI gpt-image, LocalAI, LiteLLM, Together, Fireworks … Sağlayıcıyı Ayarlar → Yapay zeka modelleri’nden ekleyin.'
  ],
  'node.audio.speech.description': [
    'Speaks text through an OpenAI compatible /audio/speech endpoint, including OpenAI TTS, Kokoro, openedai-speech, LocalAI and Chatterbox. The Prompt Engine can write character dialogue.',
    '通过兼容 OpenAI 的 /audio/speech 端点合成语音，支持 OpenAI TTS、Kokoro、openedai-speech、LocalAI 和 Chatterbox。提示词引擎可编写角色台词。',
    'Metni OpenAI uyumlu bir konuşma ucuyla (/audio/speech) seslendirir: OpenAI TTS, Kokoro-FastAPI, openedai-speech, LocalAI, Chatterbox … Prompt Motoru “Ses Satırı” hedefiyle karakterin repliğini yazabilir.'
  ],
  'node.http.request.description': [
    'Connects custom APIs, including asynchronous cloud jobs. Request placeholders: {{PROMPT}}, {{NEGATIVE}}, {{SEED}}, {{SECONDS}}, {{ASSET}}, {{IMAGE_B64}}, {{IMAGE_DATA_URI}}, {{AUDIO_B64}}, {{MODEL_B64}}. Read results from a response path such as data.0.url, or from the response itself.',
    '连接自定义 API，包括异步云端任务。请求占位符：{{PROMPT}}、{{NEGATIVE}}、{{SEED}}、{{SECONDS}}、{{ASSET}}、{{IMAGE_B64}}、{{IMAGE_DATA_URI}}、{{AUDIO_B64}}、{{MODEL_B64}}。从 data.0.url 等响应路径或响应本身读取结果。',
    'Standart API’si olmayan herhangi bir projeyi bağlar (kendi 3D/ses/hareket sunucunuz, iş kimliği dönen bulut API’leri). İsteği şablonla kurun: {{PROMPT}}, {{NEGATIVE}}, {{SEED}}, {{SECONDS}}, {{ASSET}}, {{IMAGE_B64}}, {{IMAGE_DATA_URI}}, {{AUDIO_B64}}, {{MODEL_B64}}. Sonucu yanıttaki yoldan (ör. data.0.url) ya da yanıtın kendisinden alır.'
  ],
  'node.gradio.app.description': [
    'Runs a Gradio app installed from a repository, launched by Pinokio, hosted on another computer or on Hugging Face Spaces. Inputs are mapped automatically and image/model/audio outputs pass to later nodes.',
    '运行从仓库安装、由 Pinokio 启动、位于其他电脑或 Hugging Face Spaces 上的 Gradio 应用。输入会自动映射，图像、模型、音频输出将传给后续节点。',
    'Herhangi bir Gradio uygulamasını çalıştırır: git deposundan kurduğun özel arka uç, Pinokio’nun açtığı bir uygulama, ağdaki başka bir bilgisayar ya da Hugging Face Space. Girişler (prompt, görsel, model, ses, seed, süre) uygulamanın alanlarına kendiliğinden eşlenir; çıktıdaki görsel / 3D model / ses sonraki düğümlere geçer.'
  ],
  'node.agent.task.description': [
    "The selected AI completes this step using connected tools (Blender MCP, Unreal MCP, terminal). It saves files in this node's folder and passes models/images/audio onward. Quality feedback returns to this node.",
    '所选 AI 使用连接的工具（Blender MCP、Unreal MCP、终端）完成此步骤，将文件保存到节点文件夹并向后传递模型、图像或音频。质量检查反馈会返回此节点。',
    'Seçtiğin yapay zekâ (Claude, OpenAI uyumlu bir model, Claude Code ya da Codex) bu adımı kendi başına yapar: bağladığın araçları (Blender MCP, Unreal MCP, terminal…) kullanır, dosyaları bu düğümün klasörüne bırakır. Model / görsel / ses olarak sonraki düğümlere geçer. Kalite kontrol geri bildirimi bu düğüme gelir.'
  ],
  'node.model.meshy.text3d.description': [
    'Generates a 3D model from a prompt, with preview and optional texture refinement.',
    '根据提示词生成 3D 模型，包含预览及可选的纹理细化。',
    'Prompttan 3D model üretir (önizleme + isteğe bağlı doku/refine).'
  ],
  'node.model.meshy.image3d.description': ['Generates a 3D model from one or multiple image views.', '根据单张或多角度图像生成 3D 模型。', 'Görselden (tek veya çoklu açı) 3D model üretir.'],
  'node.model.meshy.retexture.description': ['Applies a new texture to an existing model using a prompt.', '根据提示词为现有模型重新生成纹理。', 'Var olan modele prompt ile yeni doku giydirir.'],
  'node.model.meshy.remesh.description': [
    'Reduces polygon count to the budget or adjusts topology, including LOD preparation.',
    '将多边形数量减至预算，或调整拓扑，也可用于制作 LOD。',
    'Poligon bütçesine indirir / topolojiyi düzenler (LOD için de kullanılır).'
  ],
  'node.model.meshy.rig.description': [
    'Rigs a textured humanoid biped and provides walking/running animation.',
    '为带纹理的双足人形模型绑定骨骼，并提供行走和奔跑动画。',
    'Dokulu insansı (iki ayaklı) modeli rigler; yürüme/koşma animasyonu da verir.'
  ],
  'node.blender.process.description': [
    'Runs Blender in the background to scale, position the pivot, reduce polygons, name and export the model, and render quality-check previews.',
    '后台运行 Blender，调整尺寸和轴心、减少多边形、命名并导出模型，同时渲染质量检查预览。',
    'Blender arka planda: ölçeği asset boyutuna oturtur, pivotu tabana alır, bütçeye göre azaltır, isimlendirir, FBX çıkarır ve kalite kontrol için önizleme render eder.'
  ],
  'node.rig.assembly.description': [
    'Measures the model in Blender. AI separates moving parts, adds bones at pivots, effect points, deformation zones and open/close clips, and maps kit audio. It reviews renders to revise its plan. Unreal Export builds a skeletal mesh and vehicle/object Blueprint.',
    '在 Blender 中测量模型。AI 分离活动部件，在轴心处添加骨骼，设置特效点、变形区域和开合片段，并匹配套件音频。它会检查渲染结果并修正方案。Unreal 导出会创建骨骼网格及载具或物体蓝图。',
    'Modeli Blender’da ölçer; yapay zekâ ölçülü görünüşlere bakıp hareketli parçaları (tekerlek, kapı, kaput, bagaj, kapak…) keser, pivotlarına kemik koyar, efekt noktalarını (egzoz, far, toz), ezilme bölgelerini (morph target + hasar maskesi) ve açılma/kapanma kliplerini ekler, kit seslerini kliplere eşler. Kontrol render’larına bakıp kendi planını düzeltir. Unreal Export bunu iskeletli mesh + araç / obje Blueprint’i olarak kurar.'
  ],
  'node.qa.review.description': [
    'Checks model/image geometry and appearance, animation foot contact, stability and motion targets, and audio silence, clipping, level, duration and loop seams. Low scores send feedback to the nearest Prompt Engine or Kimodo node for regeneration.',
    '检查模型或图像的几何与外观、动画的脚部接触、稳定性与运动目标，以及音频的静音、削波、电平、时长和循环接缝。低分时向最近的提示词引擎或 Kimodo 节点反馈并重新生成。',
    'Model ve görsel: teknik kontrol (poligon, UV, ölçü) + Claude görsel inceleme. Animasyon: ayak kayması, zemine girme, titreme, kopukluk, hedef hız/yön/dönüş. Ses: sessizlik, kırpılma, seviye, süre, döngü dikişi (ücretsiz, yerel ölçüm). Puan düşükse en yakın Prompt Motoruna ya da Kimodo düğümüne geri bildirim gönderip yeniden ürettirir.'
  ],
  'node.audio.elevenlabs.description': [
    'Generates sound effects or ambience, with one file per variation.',
    '生成音效或环境声，每个变体输出一个文件。',
    'Ses efekti / ambiyans üretir. Varyasyon sayısı kadar dosya çıkarır.'
  ],
  'node.audio.engine.description': [
    'Generates seamless engine-audio layers at different RPMs. Unreal export connects them to a MetaSound with RPM and Throttle inputs for smooth pitch and layer transitions.',
    '在不同转速下生成无缝循环的引擎音频层。Unreal 导出会将其连接到带 RPM 和 Throttle 输入的 MetaSound，实现平滑的音高与层级过渡。',
    'Aynı motordan farklı devirlerde kusursuz döngü katmanları üretir. Unreal export bunları RPM ve Throttle girişli bir MetaSound’a bağlar: oyunda devir değiştikçe perde ve katmanlar akıcı geçiş yapar.'
  ],
  'node.anim.kimodo.description': [
    'Generates human motion with NVIDIA Kimodo (SOMA skeleton), converts bone names to Manny in Blender and exports FBX with root motion. Unreal export retargets it to the character.',
    '使用 NVIDIA Kimodo（SOMA 骨骼）生成人体动作，在 Blender 中转换为 Manny 骨骼名称并导出带根运动的 FBX。Unreal 导出会将其重定向到角色。',
    'NVIDIA Kimodo ile metinden insan hareketi üretir (SOMA iskeleti), Blender’da Manny adlarına çevirip root motion’lı FBX yapar. Unreal export ana karaktere otomatik retarget eder.'
  ],
  'node.export.ue.description': [
    'Copies files to the export folder using naming rules; imports automatically through Python Remote Execution when Unreal is open.',
    '按命名规则将文件放入导出目录；Unreal 打开时，通过 Python Remote Execution 自动导入。',
    'Dosyaları isimlendirme kurallarıyla export klasörüne koyar; Unreal açıksa Python Remote Execution ile otomatik import eder.'
  ],
  'node.model.file.file.help': ['e.g. C:\\Projects\\Export\\{id}.glb', '例如 C:\\Projects\\Export\\{id}.glb', 'ör. C:\\Projelerim\\Export\\{id}.glb'],
  'node.prompt.generate.extra.help': ['Extra instructions added to every prompt in this pipeline', '添加到此流水线每条提示词的额外指令', 'Bu hatta her prompta eklenecek özel yönlendirme'],
  'node.image.meshy.multi_view.help': ['Generate multiple views (better for 3D)', '生成多视角图像（更适合 3D）', 'Birden çok açıdan görsel üretir (3D için daha iyi)'],
  'node.image.meshy.pose_mode..option': ['None', '无', 'Yok'],
  'node.image.meshy.pose_mode.auto.option': ['From prompt', '从提示词获取', 'Prompttan al'],
  'node.image.comfyui.workflow.help': ['Settings → Local tools → ComfyUI → Workflow library', '设置 → 本地工具 → ComfyUI → 工作流库', 'Ayarlar → Yerel araçlar → ComfyUI → Workflow kitaplığı'],
  'node.image.comfyui.server.help': [
    'Automatic: online server with required nodes/models and the shortest queue',
    '自动：具备所需节点和模型且队列最短的在线服务器',
    'Otomatik = açık, gerekli düğüm ve modelleri olan, kuyruğu en kısa sunucu'
  ],
  'node.image.comfyui.seed.help': ['-1 = random', '-1 = 随机', '-1 = rastgele'],
  'node.comfy.workflow.workflow.help': [
    'Add in Settings → Local tools → ComfyUI → Workflow library (ComfyUI → Workflow → Export (API))',
    '在设置 → 本地工具 → ComfyUI → 工作流库中添加（ComfyUI → Workflow → Export (API)）',
    'Ayarlar → Yerel araçlar → ComfyUI → Workflow kitaplığına ekleyin (ComfyUI → Workflow → Export (API))'
  ],
  'node.comfy.workflow.server.help': [
    'Automatic: online server with required nodes/models and shortest queue. Generate 3D on one computer and audio on another.',
    '自动：具备所需节点和模型且队列最短的在线服务器。可在一台电脑生成 3D，在另一台生成音频。',
    'Otomatik = açık, gerekli düğüm ve modelleri olan, kuyruğu en kısa sunucu. Örn. 3D’yi bir bilgisayarda, sesi diğerinde üretin.'
  ],
  'node.comfy.workflow.seed.help': ['-1 = new seed each run', '-1 = 每次运行使用新种子', '-1 = her çalıştırmada yeni'],
  'node.comfy.workflow.seconds.help': ['0 = duration in the prompt or workflow', '0 = 提示词或工作流中的时长', '0 = prompttaki süre ya da workflow’daki değer'],
  'node.image.openai.model.help': [
    'Image model name on the server (e.g. gpt-image-1, dall-e-3, flux-schnell, stablediffusion)',
    '服务器上的图像模型名称（例如 gpt-image-1、dall-e-3、flux-schnell、stablediffusion）',
    'Sunucudaki görsel modelinin adı (ör. gpt-image-1, dall-e-3, flux-schnell, stablediffusion)'
  ],
  'node.image.openai.size..option': ['Server default', '服务器默认', 'Sunucunun varsayılanı'],
  'node.image.openai.size.1536x1024.option': ['1536×1024 (landscape)', '1536×1024（横向）', '1536×1024 (yatay)'],
  'node.image.openai.size.1024x1536.option': ['1024×1536 (portrait)', '1024×1536（纵向）', '1024×1536 (dikey)'],
  'node.image.openai.quality..option': ['Server default', '服务器默认', 'Sunucunun varsayılanı'],
  'node.image.openai.quality.low.option': ['Low', '低', 'Düşük'],
  'node.image.openai.quality.medium.option': ['Medium', '中', 'Orta'],
  'node.image.openai.quality.high.option': ['High', '高', 'Yüksek'],
  'node.audio.speech.model.help': ['e.g. gpt-4o-mini-tts, tts-1, kokoro', '例如 gpt-4o-mini-tts、tts-1、kokoro', 'ör. gpt-4o-mini-tts, tts-1, kokoro'],
  'node.audio.speech.voice.help': ['Voice name on the server (e.g. alloy, nova, af_bella)', '服务器上的音色名称（例如 alloy、nova、af_bella）', 'Sunucudaki ses adı (ör. alloy, nova, af_bella)'],
  'node.audio.speech.instructions.help': ['For supported models: e.g. “tired, whispering”', '供支持的模型使用，例如“疲倦、低声耳语”', 'Destekleyen modeller için: “yorgun, fısıltıyla” gibi'],
  'node.http.request.url.help': ['Placeholders such as {{PROMPT}} are supported', '支持 {{PROMPT}} 等占位符', '{{PROMPT}} gibi yer tutucular kullanılabilir'],
  'node.http.request.auth.help': [
    'Send this provider’s key as Authorization: Bearer; the key is not saved in the project',
    '使用此提供商的密钥发送 Authorization: Bearer；密钥不会写入项目',
    'Anahtarı bu sağlayıcıdan alıp Authorization: Bearer olarak gönderir; anahtar projeye yazılmaz'
  ],
  'node.http.request.headers.help': [
    'One “Name: value” per line. Use Authentication for keys.',
    '每行填写“名称: 值”。密钥请使用身份验证字段。',
    'Her satıra “Ad: değer”. Anahtar yazmayın; “Kimlik” alanını kullanın'
  ],
  'node.http.request.body_type.json.option': ['JSON template', 'JSON 模板', 'JSON şablonu'],
  'node.http.request.body_type.multipart.option': ['Multipart (file upload)', '多部分（文件上传）', 'Çok parçalı (dosya yükleme)'],
  'node.http.request.body_type.none.option': ['None', '无', 'Yok'],
  'node.http.request.body.help': [
    'JSON: quote text placeholders. Multipart: field=value per line; field=@image / @model / @audio for files',
    'JSON：为文本占位符加引号。多部分：每行 field=value；文件使用 field=@image / @model / @audio',
    'JSON: metin yer tutucularını tırnak içine yazın. Çok parçalı: her satıra alan=değer; dosya için alan=@image / @model / @audio'
  ],
  'node.http.request.result_path.help': [
    'Empty = response is a file. E.g. data.0.url, output.mesh, images.*.url (URL, data: or base64)',
    '留空表示响应本身为文件。例如 data.0.url、output.mesh、images.*.url（URL、data: 或 base64）',
    'Boş = yanıtın kendisi dosya. Ör. data.0.url, output.mesh, images.*.url (adres, data: ya da base64)'
  ],
  'node.http.request.id_path.help': ['If the endpoint immediately returns a job ID, e.g. id', '用于立即返回任务 ID 的端点，例如 id', 'Uç hemen bir iş kimliği dönüyorsa, ör. id'],
  'node.http.request.poll_url.help': [
    'e.g. https://api.example.com/v1/jobs/{{ID}}; result path applies to this response',
    '例如 https://api.example.com/v1/jobs/{{ID}}；结果路径应用于此响应',
    'ör. https://api.ornek.com/v1/jobs/{{ID}}; sonuç yolu bu yanıta uygulanır'
  ],
  'node.http.request.done_values.help': ['Comma separated; empty = succeeded, completed, done …', '逗号分隔；留空 = succeeded、completed、done …', 'Virgülle; boş = succeeded, completed, done …'],
  'node.http.request.seed.help': ['-1 = new seed each run', '-1 = 每次运行使用新种子', '-1 = her çalıştırmada yeni'],
  'node.gradio.app.backend.help': [
    'Selected custom backends start automatically when needed. Empty = address below',
    '所选自定义后端会按需自动启动。留空使用下方地址',
    'Özel arka uç seçilirse gerekince kendiliğinden başlatılır. Boş = aşağıdaki adres'
  ],
  'node.gradio.app.url.help': [
    'e.g. http://127.0.0.1:7860 or https://user-app.hf.space',
    '例如 http://127.0.0.1:7860 或 https://user-app.hf.space',
    'ör. http://127.0.0.1:7860 ya da https://kullanici-uygulama.hf.space'
  ],
  'node.gradio.app.endpoint.help': [
    'Empty = first endpoint. Inspect with Settings → Custom backends → Show endpoints (e.g. /predict)',
    '留空使用第一个端点。在设置 → 自定义后端 → 显示端点中查看（例如 /predict）',
    'Boş = ilki. Ayarlar → Özel arka uçlar → “Uç noktaları göster” ile görün (ör. /predict)'
  ],
  'node.gradio.app.values.help': [
    'Parameter name or label → value, e.g. {"steps": 30, "guidance_scale": 7}',
    '参数名或标签 → 值，例如 {"steps": 30, "guidance_scale": 7}',
    'Parametre adı ya da etiketi → değer, ör. {"steps": 30, "guidance_scale": 7}'
  ],
  'node.gradio.app.seed.help': ['-1 = random', '-1 = 随机', '-1 = rastgele'],
  'node.gradio.app.seconds.help': ['0 = prompt duration or app default', '0 = 提示词时长或应用默认值', '0 = prompttaki süre ya da uygulamanın varsayılanı'],
  'node.agent.task.engine.help': [
    'API: provider in Settings → AI. Claude Code / Codex: installed and signed-in CLI',
    'API：设置 → AI 中的提供商。Claude Code / Codex：已安装并登录的 CLI',
    'API: Ayarlar → Yapay zekâ’daki sağlayıcı. Claude Code / Codex: bilgisayarında kurulu, giriş yapılmış CLI'
  ],
  'node.agent.task.engine.api.option': ['API (LLM in Settings)', 'API（设置中的 LLM）', 'API (Ayarlar’daki LLM)'],
  'node.agent.task.engine.claude-code.option': ['Claude Code (subscription)', 'Claude Code（订阅）', 'Claude Code (aboneliğinle)'],
  'node.agent.task.engine.codex.option': ['Codex CLI (subscription)', 'Codex CLI（订阅）', 'Codex CLI (aboneliğinle)'],
  'node.agent.task.provider.help': ['Empty = producer assistant model', '留空使用制作助手的模型', 'Boş = Yapımcı asistanının modeli'],
  'node.agent.task.mcp.help': [
    'Servers from Settings → MCP. Tools run without approval in this node',
    '设置 → MCP 中的服务器。此节点调用工具时无需确认',
    'Ayarlar → MCP’de eklediğin sunucular. Bu düğümde onay sormadan çalışırlar'
  ],
  'node.agent.task.shell.help': [
    'Allows commands (blender --background, ffmpeg, python…). Enable only for trusted tasks',
    '允许运行命令（blender --background、ffmpeg、python…）。仅对可信任务启用',
    'Komut çalıştırabilir (blender --background, ffmpeg, python…). Yalnızca güvendiğin görevlerde aç'
  ],
  'node.agent.task.task.help': [
    'Task instructions, e.g. “Build a low-poly model in Blender with separate wheels and save GLB”. {asset} = asset name',
    '任务指令，例如“在 Blender 中制作低多边形模型，车轮作为独立物体，保存为 GLB”。{asset} = 资源名称',
    'Ne yapsın? Ör. "Blender’da asset’in low-poly modelini kur, tekerlekleri ayrı obje yap, GLB olarak kaydet". {asset} = asset adı'
  ],
  'node.agent.task.expect.any.option': ['Any output', '任意输出', 'Ne üretirse'],
  'node.agent.task.cli_model.help': ['For Claude Code / Codex; empty = CLI default', '用于 Claude Code / Codex；留空使用 CLI 默认值', 'Claude Code / Codex için; boş = CLI varsayılanı'],
  'node.model.meshy.text3d.ai_model.latest.option': ['Latest Meshy', '最新 Meshy', 'Meshy en güncel'],
  'node.model.meshy.text3d.ai_model.meshy-6-lite.option': ['Meshy 6 Lite (budget)', 'Meshy 6 Lite（经济）', 'Meshy 6 Lite (ucuz)'],
  'node.model.meshy.text3d.target_polycount.help': ['0 = budget from asset list / Project Bible', '0 = 资源列表或项目设定集中的预算', '0 = asset listesindeki / Proje Kitabındaki bütçe'],
  'node.model.meshy.text3d.pose_mode..option': ['None', '无', 'Yok'],
  'node.model.meshy.text3d.pose_mode.auto.option': ['From prompt', '从提示词获取', 'Prompttan al'],
  'node.model.meshy.image3d.ai_model.latest.option': ['Latest Meshy', '最新 Meshy', 'Meshy en güncel'],
  'node.model.meshy.image3d.ai_model.meshy-6-lite.option': ['Meshy 6 Lite (budget)', 'Meshy 6 Lite（经济）', 'Meshy 6 Lite (ucuz)'],
  'node.model.meshy.image3d.target_polycount.help': ['0 = budget from asset list / Project Bible', '0 = 资源列表或项目设定集中的预算', '0 = asset listesindeki / Proje Kitabındaki bütçe'],
  'node.model.meshy.image3d.pose_mode..option': ['None', '无', 'Yok'],
  'node.model.meshy.image3d.pose_mode.auto.option': ['From prompt', '从提示词获取', 'Prompttan al'],
  'node.model.meshy.retexture.ai_model.latest.option': ['Latest', '最新', 'En güncel'],
  'node.model.meshy.remesh.topology.triangle.option': ['Triangle', '三角形', 'Üçgen'],
  'node.model.meshy.remesh.target_polycount.help': ['0 = budget from asset list / Project Bible', '0 = 资源列表或项目设定集中的预算', '0 = asset listesindeki / Proje Kitabındaki bütçe'],
  'node.model.meshy.rig.height_meters.help': ['0 = asset dimensions', '0 = 使用资源尺寸', '0 = asset boyutundan'],
  'node.blender.process.origin.bottom.option': ['Bottom center', '底部中心', 'Taban ortası'],
  'node.blender.process.origin.center.option': ['Center', '中心', 'Merkez'],
  'node.blender.process.origin.keep.option': ['Keep unchanged', '保持不变', 'Değiştirme'],
  'node.blender.process.skeleton.help': [
    'Rename rigged character bones to Manny conventions for automatic IK Rig and retarget matching',
    '将绑定角色的骨骼重命名为 Manny 标准，以自动匹配 IK Rig 和重定向',
    'Rigli karakterlerde kemik adlarını Manny standardına çevirir; IK Rig ve retarget otomatik eşleşir'
  ],
  'node.blender.process.skeleton.none.option': ['Keep unchanged', '保持不变', 'Değiştirme'],
  'node.blender.process.skeleton.manny.option': ['UE5 Manny/Quinn names', 'UE5 Manny/Quinn 名称', 'UE5 Manny/Quinn adları'],
  'node.rig.assembly.engine.help': [
    'Claude Code / Codex inspect validation renders and run Blender directly',
    'Claude Code / Codex 会直接检查验证渲染图并运行 Blender',
    'Claude Code / Codex: kontrol render’larına kendisi bakar, Blender’ı kendisi çalıştırır'
  ],
  'node.rig.assembly.engine.api.option': ['API (LLM in Settings)', 'API（设置中的 LLM）', 'API (Ayarlar’daki LLM)'],
  'node.rig.assembly.engine.claude-code.option': ['Claude Code (subscription)', 'Claude Code（订阅）', 'Claude Code (aboneliğinle)'],
  'node.rig.assembly.engine.codex.option': ['Codex CLI (subscription)', 'Codex CLI（订阅）', 'Codex CLI (aboneliğinle)'],
  'node.rig.assembly.provider.help': ['Empty = visual quality control model in Settings', '留空使用设置中的视觉质量检查模型', 'Boş = Ayarlar’daki kalite kontrol (görsel) modeli'],
  'node.rig.assembly.extra.help': ['E.g. “Open four doors and trunk, keep hood closed”', '例如“四个车门和后备箱可打开，引擎盖保持关闭”', 'Ör. "4 kapı ve bagaj açılsın, kaput açılmasın"'],
  'node.rig.assembly.length.help': ['0 = asset dimensions or model', '0 = 使用资源尺寸或模型', '0 = asset boyutundan ya da modelden'],
  'node.rig.assembly.rounds.help': [
    'Maximum AI plan revisions after inspecting validation renders',
    'AI 检查验证渲染图后修改方案的最大次数',
    'Yapay zekâ kontrol render’larına bakıp planı en fazla bu kadar düzeltir'
  ],
  'node.rig.assembly.plan.help': [
    'If set, skip AI; see format at the top of resources/python/forge_assembly.py',
    '填写后跳过 AI；格式见 resources/python/forge_assembly.py 文件开头',
    'Doluysa yapay zekâ atlanır; biçim resources/python/forge_assembly.py başında'
  ],
  'node.qa.review.on_fail.stop.option': ['Stop', '停止', 'Durdur'],
  'node.qa.review.on_fail.continue.option': ['Continue with warning', '警告后继续', 'Uyarıyla devam'],
  'node.qa.review.focus.help': ['E.g. “Silhouette must be readable from a distance”', '例如“远处也能清晰辨认轮廓”', 'Ör. "silüet uzaktan okunmalı"'],
  'node.audio.elevenlabs.duration.help': ['0 = let the prompt engine choose', '0 = 由提示词引擎选择', '0 = prompt motoru seçsin'],
  'node.audio.elevenlabs.loop.auto.option': ['From prompt', '从提示词获取', 'Prompttan al'],
  'node.audio.elevenlabs.loop.yes.option': ['Yes', '是', 'Evet'],
  'node.audio.elevenlabs.loop.no.option': ['No', '否', 'Hayır'],
  'node.audio.engine.layers.help': ['2–8; more layers give smoother transitions', '2–8；层数越多，过渡越平滑', '2-8; fazlası daha akıcı geçiş'],
  'node.anim.kimodo.prompt.help': [
    'Empty = Claude writes from asset description. One segment per line',
    '留空由 Claude 根据资源描述编写。每行对应一个片段',
    'Boş = asset açıklamasından Claude yazar. Her satır = sıralı bir segment'
  ],
  'node.anim.kimodo.seconds.help': ['E.g. “4” or “3 2” per segment; empty = automatic', '例如“4”，或按片段填写“3 2”；留空自动设置', 'ör. "4" veya segment başına "3 2"; boş = otomatik'],
  'node.anim.kimodo.root_motion.root.option': ['Transfer to root bone', '转移到根骨骼', 'Root kemiğine aktar'],
  'node.anim.kimodo.root_motion.inplace.option': ['In place', '原地', 'Yerinde (in-place)'],
  'node.anim.kimodo.root_motion.raw.option': ['Raw', '原始', 'Ham'],
  'node.anim.kimodo.seed.help': ['-1 = random', '-1 = 随机', '-1 = rastgele'],
  'node.export.ue.content_path.help': ['Empty = <UE root>/<category>', '留空 = <UE 根目录>/<类别>', 'Boş = <UE kökü>/<kategori>'],
  'node.export.ue.lods.help': ['For skeletal meshes; empty = no LODs', '用于骨骼网格；留空不生成 LOD', 'İskeletli mesh için; boş = LOD yok'],
  'node.export.ue.ik_rig.help': [
    'Create IK Rig and Manny-to-character retargeter for skeletal meshes',
    '为骨骼网格创建 IK Rig 和 Manny 到角色的重定向器',
    'İskeletli mesh için IK Rig ve Manny→karakter retargeter kurar'
  ],
  'node.export.ue.template.help': [
    'Vehicle Blueprint to copy for assembled vehicles (/Game/...). Empty = matching project KV template',
    '装配车辆要复制的车辆蓝图（/Game/...）。留空使用项目中适配的 KV 模板',
    'Montajlı araç için kopyalanacak araç Blueprint’i (/Game/...). Boş = projedeki KV şablonlarından uygun olanı'
  ],
  'node.export.ue.kit_wait.help': [
    'Maximum wait while door / engine / horn sounds are still generating',
    '车门、引擎或喇叭音效仍在生成时的最长等待时间',
    'Montajlı araçta kapı / motor / korna sesleri hâlâ üretiliyorsa en fazla bu kadar beklenir'
  ]
} as const
