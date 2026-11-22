// SPDX-License-Identifier: AGPL-3.0-only
// Each row is [English, Simplified Chinese, Turkish]. Keep technical values out of this table.
const rows = {
  'web.loginTitle': ['Sign in', '登录', 'Giriş'],
  'web.loginHeading': ['Sign in', '登录', 'Giriş yap'],
  'web.loginHelp': [
    'Use the account provided by the person sharing this AssetForge instance.',
    '使用此 AssetForge 实例共享者提供的账号登录。',
    'Bu AssetForge’u paylaşan kişinin verdiği hesapla girin.'
  ],
  'web.name': ['Name', '名称', 'Ad'],
  'web.password': ['Password', '密码', 'Parola'],
  'web.join': ['Join', '加入', 'Katıl'],
  'web.joinHeading': ['Join the project', '加入项目', 'Projeye katıl'],
  'web.joinHelp': ['Your role: {role}. Choose a name and password.', '你的角色：{role}。请设置名称和密码。', 'Rolün: {role}. Kendine bir ad ve parola seç.'],
  'web.viewerRole': ['Viewer (view only)', '查看者（只读）', 'İzleyici (yalnızca görüntüleme)'],
  'web.editorRole': ['Editor (can produce and edit)', '编辑者（可生产与编辑）', 'Editör (üretebilir ve düzenleyebilirsin)'],
  'web.newPassword': ['Password (at least 8 characters)', '密码（至少 8 个字符）', 'Parola (en az 8 karakter)'],
  'web.rateLimit': ['Too many attempts. Try again in 10 minutes.', '尝试次数过多，请在 10 分钟后重试。', 'Çok fazla deneme. 10 dakika sonra yeniden deneyin.'],
  'web.invalidLogin': ['Incorrect name or password', '名称或密码错误', 'Ad ya da parola yanlış'],
  'web.invitation': ['Invitation', '邀请', 'Davet'],
  'web.invalidInvite': ['Invalid invitation', '邀请无效', 'Davet geçersiz'],
  'web.invalidInviteHelp': [
    'This link has expired or has already been used. Ask the person sharing the project for a new invitation.',
    '此链接已过期或已被使用，请向项目共享者索取新的邀请。',
    'Bu bağlantının süresi dolmuş ya da kullanılmış. Paylaşan kişiden yeni bir davet isteyin.'
  ],
  'web.nameLength': ['Name must be 2–40 characters', '名称长度须为 2–40 个字符', 'Ad 2–40 karakter olmalı'],
  'web.passwordLength': ['Password must be at least 8 characters', '密码至少需要 8 个字符', 'Parola en az 8 karakter olmalı'],
  'web.nameTaken': ['This name is already in use; choose another', '此名称已被使用，请选择其他名称', 'Bu ad kullanılıyor; başka bir ad seçin'],
  'web.accountNameTaken': ['This name is used by another account', '此名称已被其他账号使用', 'Bu ad başka bir hesapta kullanılıyor'],
  'web.ownerInvite': ['Cannot create an owner invitation', '无法创建所有者邀请', 'Sahip daveti oluşturulamaz'],
  'web.inviteExpired': ['Invitation is invalid or has expired', '邀请无效或已过期', 'Davet geçersiz ya da süresi dolmuş'],
  'settings.concurrentHelp': ['1–4 recommended, depending on Meshy and Claude rate limits', '建议 1–4 个，取决于 Meshy 和 Claude 请求限制', 'Meshy ve Claude istek sınırlarına göre 1-4 önerilir'],
  'settings.audioHelp': ['ElevenLabs outputs are saved in this format', 'ElevenLabs 输出将保存为此格式', 'ElevenLabs çıktıları bu formatta kaydedilir'],
  'settings.blenderDesc': [
    'Runs in the background for cleanup, scaling, LOD, export and preview rendering.',
    '在后台执行清理、缩放、LOD、导出与预览渲染。',
    'Temizlik, ölçekleme, LOD, export ve önizleme render için arka planda çalışır.'
  ],
  'settings.blenderMissing': [
    'Not found — download Blender from blender.org if it is not installed',
    '未找到 — 如未安装 Blender，请从 blender.org 下载',
    'Bulunamadı — Blender kurulu değilse blender.org’dan indirin'
  ],
  'settings.choose': ['Choose…', '选择…', 'Seç…'],
  'settings.comfyDesc': [
    'Runs ComfyUI workflows for images, textures, 3D models, audio and animation. Add multiple computers to distribute work across GPUs. Local models (TRELLIS.2, Hunyuan3D, ACE-Step, Kimodo…) are free; partner nodes (Meshy, Tripo, Rodin, ElevenLabs…) use Comfy account credits.',
    '运行生成图像、纹理、3D 模型、音频和动画的 ComfyUI 工作流。可添加多台计算机分配 GPU 任务。本地模型（TRELLIS.2、Hunyuan3D、ACE-Step、Kimodo 等）免费；合作节点（Meshy、Tripo、Rodin、ElevenLabs 等）消耗 Comfy 账号积分。',
    'Görsel, doku, 3D model, ses ve animasyon üreten ComfyUI workflow’larını çalıştırır. Birden çok bilgisayar ekleyebilirsiniz: örneğin 3D’yi güçlü GPU’lu bilgisayarda, sesi diğerinde üretin. Yerel modeller (TRELLIS.2, Hunyuan3D, ACE-Step, Kimodo …) ücretsizdir; partner düğümleri (Meshy, Tripo, Rodin, ElevenLabs …) Comfy hesabı kredisiyle çalışır.'
  ],
  'settings.comfyAccount': ['Comfy account', 'Comfy 账号', 'Comfy hesabı'],
  'settings.comfyKeyLink': ['platform.comfy.org → API Keys (partner nodes only)', 'platform.comfy.org → API Keys（仅合作节点需要）', 'platform.comfy.org → API Keys (yalnızca partner düğümleri için)'],
  'settings.comfyLibraryDesc': [
    'Keep workflows exported from ComfyUI (Workflow → Export (API)) here and select them in ComfyUI nodes. Set preferred servers and check each server for missing nodes or models.',
    '在此保存从 ComfyUI 导出的工作流（Workflow → Export (API)），并在 ComfyUI 节点中选择。可设置首选服务器，并检查各服务器缺失的节点或模型。',
    'ComfyUI’da kurduğunuz workflow’ları (Workflow → Export (API)) burada saklayın; ComfyUI düğümleri buradan seçer. Her workflow’un tercih ettiği sunucuyu belirleyebilir, sunucularda eksik düğüm ve model olup olmadığını denetleyebilirsiniz.'
  ],
  'settings.comfyLocalDesc': [
    'If you do not have ComfyUI, AssetForge can install it here and start it in the background when needed (Windows + NVIDIA). Uses the “This computer” server entry.',
    '如未安装 ComfyUI，AssetForge 可在此安装并按需后台启动（Windows + NVIDIA），使用“此计算机”服务器条目。',
    'Kendi ComfyUI’ınız yoksa AssetForge bu bilgisayara kurup gerektiğinde arka planda başlatır (Windows + NVIDIA). Listedeki “Bu bilgisayar” kaydını kullanır.'
  ],
  'settings.comfyDirHelp': [
    'ComfyUI, its Python environment and models are installed here. Models can require tens of GB.',
    'ComfyUI、Python 环境和模型安装在此；模型可能占用数十 GB。',
    'AssetForge ComfyUI’ı buraya kurar (Python ortamı, ComfyUI, modeller). Modeller büyüdükçe birkaç on GB olabilir.'
  ],
  'settings.backendDesc': [
    'Install an AI project from a Git repository. Review its assetforge.json recipe or the proposed draft before installation into a separate Python environment. It starts on demand and is available through the Gradio App pipeline node.',
    '从 Git 仓库安装 AI 项目。安装前查看 assetforge.json 配方或建议草稿；项目使用独立 Python 环境并按需启动，可通过流水线中的 Gradio 应用节点使用。',
    'ComfyUI’a henüz gelmemiş bir yapay zekâ projesini git deposundan kurun: AssetForge depoyu indirir, kurulum tarifini (assetforge.json ya da önerdiği taslak) gösterir, onaylayınca kendi Python ortamına kurar ve gerektiğinde arka planda başlatır. Hatlarda Gradio Uygulaması düğümüyle kullanılır.'
  ],
  'settings.backendDirHelp': [
    'Each backend gets its own repository, Python environment and log folder here. Hugging Face models share the _hf cache subfolder.',
    '各后端在此拥有独立仓库、Python 环境和日志目录；Hugging Face 模型共享 _hf 缓存子目录。',
    'Her arka uç burada kendi klasöründe durur (depo, Python ortamı, günlük); Hugging Face modelleri _hf alt klasöründe ortak önbelleğe iner.'
  ],
  'settings.kimodoDesc': [
    'Kimodo generates human motion from text using Meta Llama-3-8B-Instruct. Installation steps are on the Animation page.',
    'Kimodo 使用 Meta Llama-3-8B-Instruct 理解文本并生成人体动作，安装步骤位于动画页面。',
    'Kimodo metinden insan hareketi üretir; metni anlamak için Meta Llama-3-8B-Instruct kullanır. Kurulum adımları Animasyon sayfasındadır.'
  ],
  'settings.unrealStep1': ['Enable Edit → Plugins → Python Editor Script Plugin.', '启用 Edit → Plugins → Python Editor Script Plugin。', 'Edit → Plugins → Python Editor Script Plugin’i açın.'],
  'settings.unrealStep2': [
    'Enable Project Settings → Plugins → Python → Enable Remote Execution.',
    '勾选 Project Settings → Plugins → Python → Enable Remote Execution。',
    'Project Settings → Plugins → Python → Enable Remote Execution’ı işaretleyin.'
  ],
  'settings.unrealStep3': [
    'With the editor open, click Find Unreal. The Unreal Export node imports assets automatically.',
    '打开编辑器后点击“查找 Unreal”。Unreal Export 节点会自动导入资源。',
    'Editör açıkken “Unreal’ı bul”a basın. Unreal Export node’u asset’leri otomatik import eder.'
  ],
  'settings.unrealStep4': [
    'When Remote Execution is unavailable, the Unreal MCP server is used (requires a Python tool such as ExecutePython). Its tools also build physics assets and Animation Blueprints for assembled vehicles.',
    'Remote Execution 不可用时使用 Unreal MCP 服务器（需要 ExecutePython 等 Python 工具）。其工具也可为组装载具创建物理资源和动画蓝图。',
    'Remote Execution yoksa Unreal MCP sunucusu kullanılır (Python çalıştıran bir araç gerekir, ör. ExecutePython). Montajlı araçlarda fizik asset’i ve Anim BP de buradaki araç setiyle kurulur.'
  ],
  'settings.connected': ['Connected', '已连接', 'bağlı'],
  'settings.noPythonTool': ['No Python tool', '没有 Python 工具', 'Python aracı yok'],
  'settings.diagnosticsHelp': [
    'If something goes wrong, save a diagnostics file and attach it to a GitHub bug report. It includes versions, system details, a settings summary and recent logs. API keys, tokens and your username are automatically hidden.',
    '遇到问题时，可保存诊断文件并附在 GitHub 错误报告中。文件包含版本、系统信息、设置摘要和最近日志；API 密钥、令牌及用户名会自动隐藏。',
    'Bir şey ters gittiyse tanılama dosyasını kaydedip GitHub’daki hata bildirimine ekle. Dosyada sürümler, sistem bilgisi, ayar özeti ve son günlük satırları bulunur. API anahtarları, token’lar ve kullanıcı adın otomatik olarak gizlenir.'
  ],
  'native.open': ['Open AssetForge', '打开 AssetForge', 'AssetForge’u aç'],
  'native.webRunning': ['Web server running · {count} connected', 'Web 服务器运行中 · {count} 人已连接', 'Web sunucusu açık · {count} bağlı'],
  'native.webStopped': ['Web server stopped', 'Web 服务器已停止', 'Web sunucusu kapalı'],
  'native.webTooltip': ['AssetForge — web server running ({url})', 'AssetForge — Web 服务器运行中（{url}）', 'AssetForge — web sunucusu açık ({url})'],
  'native.copy': ['Copy: {url}', '复制：{url}', 'Kopyala: {url}'],
  'native.quit': ['Quit', '退出', 'Çık'],
  'native.pickProject': ['Choose project folder', '选择项目目录', 'Proje klasörü seç'],
  'native.textFiles': ['Text files', '文本文件', 'Metin'],
  'native.saveDiagnostics': ['Save diagnostics file', '保存诊断文件', 'Tanılama dosyasını kaydet'],
  'native.workshopHelp': ['Open a brief conversation', '打开创作需求对话', 'Brief sohbetini aç'],
  'native.libraryHelp': ['Open the asset library', '打开资源库', 'Asset kütüphanesini aç'],
  'native.animHelp': ['Open animation systems', '打开动画系统', 'Animasyon sistemlerini aç'],
  'native.jobsHelp': ['View running jobs', '查看运行中的任务', 'Çalışan işleri gör'],
  'native.settingsHelp': ['Accounts, tools and MCP', '账号、工具与 MCP', 'Hesaplar, araçlar ve MCP'],
  'kind.character': ['Character', '角色', 'Karakter'],
  'kind.vehicle': ['Vehicle', '载具', 'Araç'],
  'kind.creature': ['Creature', '生物', 'Yaratık'],
  'kind.weapon': ['Weapon', '武器', 'Silah'],
  'kind.model': ['Prop / Structure', '道具 / 建筑', 'Prop / Yapı'],
  'kind.texture': ['Texture', '纹理', 'Doku'],
  'kind.image': ['Image', '图像', 'Görsel'],
  'kind.sfx': ['Sound', '音效', 'Ses'],
  'kind.music': ['Music', '音乐', 'Müzik'],
  'kind.vfx': ['VFX', '视觉特效', 'VFX'],
  'kind.animation': ['Animation', '动画', 'Animasyon'],
  'home.factory': ['Asset factory', '资源工厂', 'Asset fabrikası'],
  'home.newProject': ['New project', '新项目', 'Yeni proje'],
  'home.heading': ['What shall we create?', '想制作什么？', 'Ne üretelim?'],
  'home.tagline': ['Describe it. Let the factory do the rest.', '说出想法，其余交给工厂。', 'Anlat, gerisini fabrika yapsın.'],
  'home.description': [
    'Describe your idea or drop an image. The director asks about style, colors, polygon budget and game world, then creates the complete set, from models and sound to dust and animation.',
    '描述你的想法，或拖入一张图片。创作助手会询问风格、颜色、多边形预算和游戏世界，然后一次制作从模型、声音到烟尘、动画的完整资源组合。',
    'Fikrini yaz ya da bir görsel bırak. Yönetmen sana birkaç soru sorar: stil, renk, poligon bütçesi, oyun dünyası. Sonra modelden sese, tozdan animasyona kadar bütün seti tek seferde üretir.'
  ],
  'home.placeholder': [
    'For example, a rusty but charming pickup driving through a sandy desert…',
    '例如，一辆在沙漠中行驶、锈迹斑斑却很可爱的皮卡…',
    'ör. Kumlu çölde giden, paslı ama sevimli bir pikap…'
  ],
  'home.start': ['Start', '开始', 'Başla'],
  'home.whatKind': ['What kind of asset?', '想制作哪类资源？', 'Ne tür bir şey?'],
  'home.tileHelp': ['Choose a tile and the director will start there', '点击卡片，让创作助手从这里开始', 'Bir karoya tıkla, yönetmen oradan başlasın'],
  'home.briefs': ['Briefs', '创作需求', "Brief'ler"],
  'home.conversations': ['{count} design conversations', '{count} 次设计对话', '{count} tasarım konuşması'],
  'home.conversation': ['Design conversation', '设计对话', 'Tasarım konuşması'],
  'home.committed': ['Sent to production', '已投入生产', 'Üretime gitti'],
  'home.ready': ['Ready', '已就绪', 'Hazır'],
  'home.draft': ['Draft', '草稿', 'Taslak'],
  'home.parts': ['{count} parts', '{count} 个部件', '{count} parça'],
  'home.production': ['Production line', '生产动态', 'Üretim bandı'],
  'home.active': ['{count} jobs in progress', '{count} 个任务正在运行', '{count} iş sürüyor'],
  'home.recentJobs': ['Recent jobs', '最近任务', 'son işler'],
  'home.all': ['All', '全部', 'Tümü'],
  'home.quick0': ['Rusty pickup in the desert — dust, engine sound, collisions', '沙漠中的生锈皮卡 — 烟尘、引擎声、碰撞', 'Çölde giden paslı bir pikap — toz, motor sesi, çarpışma'],
  'home.quick1': ['A cute low-poly village farmer character', '一个可爱的低多边形村庄农夫角色', 'Low poly, sevimli bir köy çiftçisi karakteri'],
  'home.quick2': ['Modular wall set for a sci-fi corridor', '科幻走廊的模块化墙体套件', 'Sci-fi koridor için modüler duvar seti'],
  'home.quick3': ['Wolf roaming a forest — walking and howling', '森林中漫步的狼 — 行走与嚎叫', 'Ormanda gezen kurt — yürüyüş ve uluma'],
  'home.characterHint': ['Rig + LOD + Manny', '绑定 + LOD + Manny', 'Rig + LOD + Manny'],
  'home.characterStart': ['I want to design a character for my game.', '我想为游戏设计一个角色。', 'Oyunum için bir karakter tasarlamak istiyorum.'],
  'home.vehicleHint': ['Body, sound, dust, damage', '车身、声音、烟尘、损伤', 'Gövde, ses, toz, hasar'],
  'home.vehicleStart': ['I want to create a drivable vehicle for my game.', '我想为游戏制作一辆可驾驶的载具。', 'Oyunum için sürülebilir bir araç üretmek istiyorum.'],
  'home.creatureHint': ['Creature / Animal', '生物 / 动物', 'Yaratık / hayvan'],
  'home.creatureStart': ['I want to design a creature for my game.', '我想为游戏设计一种生物。', 'Oyunum için bir yaratık tasarlamak istiyorum.'],
  'home.weaponHint': ['Weapon and sounds', '武器与声音', 'Silah + sesleri'],
  'home.weaponStart': ['I want to create a weapon for my game.', '我想为游戏制作一件武器。', 'Oyunum için bir silah üretmek istiyorum.'],
  'home.modelHint': ['Props, structures, environment', '道具、建筑、环境', 'Prop, yapı, çevre'],
  'home.modelStart': ['I want to create a prop or structure for my game world.', '我想为游戏世界制作道具或建筑。', 'Oyun dünyam için bir prop / yapı üretmek istiyorum.'],
  'home.textureHint': ['Ground, PBR, tileable', '地面、PBR、可平铺', 'Zemin, PBR, tileable'],
  'home.textureStart': ['I want to create a ground texture for my game world.', '我想为游戏世界制作地面纹理。', 'Oyun dünyam için bir zemin dokusu üretmek istiyorum.'],
  'home.sfxHint': ['Dynamic engine, effects', '动态引擎声、音效', 'Dinamik motor, efekt'],
  'home.sfxStart': ['I want to create sound effects for my game.', '我想为游戏制作音效。', 'Oyunum için ses efektleri üretmek istiyorum.'],
  'home.vfxHint': ['Smoke, dust, sparks', '烟雾、尘土、火花', 'Duman, toz, kıvılcım'],
  'home.vfxStart': ['I want to create visual effects (VFX) for my game.', '我想为游戏制作视觉特效（VFX）。', 'Oyunum için bir görsel efekt (VFX) üretmek istiyorum.'],
  'home.animationHint': ['Text to motion', '文本生成动作', 'Metinden hareket'],
  'home.animationStart': ['I want to create an animation set for my character.', '我想为角色制作一套动画。', 'Karakterim için animasyon seti üretmek istiyorum.'],
  'home.musicHint': ['Loops, ambience', '循环音乐、环境氛围', 'Döngü, ambiyans'],
  'home.musicStart': ['I want to create music or ambience for my game.', '我想为游戏制作音乐或环境氛围音。', 'Oyunum için müzik / ambiyans üretmek istiyorum.'],
  'preview.failed': ['Could not load preview: {detail}', '无法加载预览：{detail}', 'Önizleme yüklenemedi: {detail}'],
  'common.save': ['Save', '保存', 'Kaydet'],
  'common.delete': ['Delete', '删除', 'Sil'],
  'common.connect': ['Connect', '连接', 'Bağlan'],
  'common.version': ['Version', '版本', 'Sürüm'],
  'common.license': ['License', '许可证', 'Lisans'],
  'common.searchSettings': ['Search settings…', '搜索设置…', 'Ayar ara…'],
  'common.noResults': ['No results', '没有匹配结果', 'Sonuç yok'],
  'common.installDir': ['Installation folder', '安装目录', 'Kurulum klasörü'],
  'common.serviceUrl': ['Service URL', '服务地址', 'Servis adresi'],
  'common.seconds': ['seconds', '秒', 'sn'],
  'settings.categories': ['Settings categories', '设置分类', 'Ayar kategorileri'],
  'settings.connect': ['Accounts and API', '账号与 API', 'Hesaplar ve API'],
  'settings.connectDesc': [
    'Claude, Meshy, ElevenLabs, Hugging Face and OpenRouter connections',
    'Claude、Meshy、ElevenLabs、Hugging Face 和 OpenRouter 连接',
    'Claude, Meshy, ElevenLabs, Hugging Face ve OpenRouter bağlantıları'
  ],
  'settings.models': ['AI models', 'AI 模型', 'Yapay zeka modelleri'],
  'settings.modelsDesc': ['Claude, local and additional models, task assignments', 'Claude、本地及其他模型、任务分配', 'Claude modeli, yerel ve ek modeller, görev atamaları'],
  'settings.project': ['Project and production', '项目与生产', 'Proje ve üretim'],
  'settings.projectDesc': ['Project folder, concurrent jobs, audio format', '项目目录、并发任务数、音频格式', 'Proje klasörü, eşzamanlı iş sayısı, ses formatı'],
  'settings.tools': ['Local tools', '本地工具', 'Yerel araçlar'],
  'settings.animDesc': ['NVIDIA Kimodo installation and service', 'NVIDIA Kimodo 安装与服务', 'NVIDIA Kimodo kurulumu ve servis'],
  'settings.unrealDesc': ['Remote Execution connection and IK Rig', '远程执行连接与 IK Rig', 'Remote Execution bağlantısı ve IK Rig'],
  'settings.mcp': ['MCP and external tools', 'MCP 与外部工具', 'MCP ve dış araçlar'],
  'settings.mcpDesc': ['Claude Code / Desktop integration, external MCP servers', 'Claude Code / Desktop 连接及外部 MCP 服务器', 'Claude Code / Desktop bağlantısı, dış MCP sunucuları'],
  'settings.web': ['Web and sharing', 'Web 与共享', 'Web ve paylaşım'],
  'settings.webDesc': [
    'Browser access, team invitations and roles, headless server mode',
    '浏览器访问、团队邀请与角色、无窗口服务器模式',
    'Tarayıcıdan erişim, ekip davetleri ve roller, yalnızca sunucu modu'
  ],
  'settings.about': ['About', '关于', 'Hakkında'],
  'settings.aboutDesc': ['Version, license, support and diagnostics', '版本、许可证、支持与诊断', 'Sürüm, lisans, destek ve tanılama'],
  'settings.keysEncrypted': ['Keys are encrypted on this computer.', '密钥在此计算机上加密存储。', 'Anahtarlar bu bilgisayarda şifreli saklanır.'],
  'settings.missingKeys': ['Some API keys are missing', '缺少部分 API 密钥', 'Eksik anahtar var'],
  'settings.mcpEnabled': ['MCP server is running', 'MCP 服务器已启动', 'MCP sunucusu açık'],
  'settings.webEnabled': ['Web server is running', 'Web 服务器已启动', 'Web sunucusu açık'],
  'settings.audio24': ['WAV 24 kHz (all plans)', 'WAV 24 kHz（所有套餐）', 'WAV 24 kHz (tüm planlar)'],
  'settings.audio44': ['WAV 44.1 kHz (Pro plan)', 'WAV 44.1 kHz（Pro 套餐）', 'WAV 44.1 kHz (Pro plan)'],
  'settings.audioMp3': ['MP3 128 kbps (Unreal may not import it)', 'MP3 128 kbps（Unreal 可能无法导入）', 'MP3 128 kbps (Unreal import etmeyebilir)'],
  'settings.manualKeys': ['Enter keys manually', '手动输入密钥', 'Anahtarları elle gir'],
  'settings.manualKeysHelp': [
    'Paste an existing key here. It is encrypted on this computer and never written to the project file.',
    '在此粘贴已有密钥。密钥在此计算机加密存储，不会写入项目文件。',
    'Anahtarınız zaten varsa buraya yapıştırabilirsiniz. Proje dosyasına yazılmaz; bu bilgisayarda şifreli saklanır.'
  ],
  'settings.keyLabel': ['{name} API key', '{name} API 密钥', '{name} API anahtarı'],
  'settings.keySaved': ['{name} key saved', '{name} 密钥已保存', '{name} anahtarı kaydedildi'],
  'settings.keyDeleted': ['{name} key deleted', '{name} 密钥已删除', '{name} anahtarı silindi'],
  'settings.keyStored': ['✓ Saved (encrypted with Windows)', '✓ 已保存（Windows 加密）', '✓ Kayıtlı (Windows şifrelemesiyle saklanır)'],
  'settings.keyMissing': ['Not set — {link}', '尚未设置 — {link}', 'Yok — {link}'],
  'settings.keyConnect': ['Not set — use Connect above or {link}', '尚未设置 — 使用上方“连接”或 {link}', 'Yok — yukarıdan “Bağlan” ya da {link}'],
  'settings.keyReplace': ['•••••••• (type to replace)', '••••••••（输入以替换）', '•••••••• (değiştirmek için yazın)'],
  'settings.keyPaste': ['Paste your key', '粘贴密钥', 'anahtarı yapıştırın'],
  'settings.testClaude': ['Test Claude', '测试 Claude', 'Claude’u test et'],
  'settings.meshyBalance': ['Meshy balance', 'Meshy 余额', 'Meshy bakiyesi'],
  'settings.credits': ['{count} credits', '{count} 积分', '{count} kredi'],
  'settings.testOk': ['{name}: connected ({detail})', '{name}：连接成功（{detail}）', '{name}: bağlantı tamam ({detail})'],
  'settings.projectTitle': ['Project', '项目', 'Proje'],
  'settings.projectDir': ['Project folder', '项目目录', 'Proje klasörü'],
  'settings.projectDirHelp': [
    'Contains forge-project.json, outputs (output/), export/ and job records',
    '保存 forge-project.json、输出（output/）、export/ 和任务记录',
    'forge-project.json, çıktılar (output/), export/ ve iş kayıtları burada tutulur'
  ],
  'settings.pickFolder': ['Choose folder…', '选择目录…', 'Klasör seç…'],
  'settings.openFolder': ['Open folder', '打开目录', 'Klasörü aç'],
  'settings.projectOpened': ['Project opened: {name}', '项目已打开：{name}', 'Proje açıldı: {name}'],
  'settings.concurrent': ['Concurrent jobs', '并发任务数', 'Eşzamanlı iş sayısı'],
  'settings.audioFormat': ['Audio format (ElevenLabs)', '音频格式（ElevenLabs）', 'Ses formatı (ElevenLabs)'],
  'settings.blenderPath': ['Blender executable', 'Blender 可执行文件', 'Blender çalıştırılabilir dosyası'],
  'settings.comfyServers': ['ComfyUI servers', 'ComfyUI 服务器', 'ComfyUI sunucuları'],
  'settings.comfyLibrary': ['ComfyUI workflow library', 'ComfyUI 工作流库', 'ComfyUI workflow kitaplığı'],
  'settings.comfyLocal': ['Install ComfyUI on this computer (optional)', '在此计算机安装 ComfyUI（可选）', 'Bu bilgisayara ComfyUI kurulumu (isteğe bağlı)'],
  'settings.backends': ['Custom backends and Gradio apps', '自定义后端与 Gradio 应用', 'Özel arka uçlar ve Gradio uygulamaları'],
  'settings.hfConnected': ['Hugging Face connected.', 'Hugging Face 已连接。', 'Hugging Face bağlı.'],
  'settings.hfRequired': [
    'A Hugging Face token is required (account must accept the Llama-3 license).',
    '需要 Hugging Face 令牌（账号须已接受 Llama-3 许可）。',
    'Hugging Face token’ı gerekli (Llama-3 lisansı kabul edilmiş hesap).'
  ],
  'settings.executionMode': ['Execution mode', '运行方式', 'Çalışma yolu'],
  'settings.executionModeHelp': [
    'Native Windows: no BIOS virtualization required (recommended). WSL2 + Docker: enable SVM/VT-x in BIOS.',
    '原生 Windows：无需 BIOS 虚拟化（推荐）。WSL2 + Docker：须在 BIOS 启用 SVM/VT-x。',
    'Yerel Windows: BIOS sanallaştırması gerekmez (önerilen). WSL2 + Docker: BIOS’ta SVM/VT-x açık olmalı.'
  ],
  'settings.native': ['Native Windows (Python + CUDA)', '原生 Windows（Python + CUDA）', 'Yerel Windows (Python + CUDA)'],
  'settings.kimodoDir': ['Kimodo installation folder', 'Kimodo 安装目录', 'Kimodo kurulum klasörü'],
  'settings.kimodoDirHelp': [
    'About 25 GB (PyTorch + models). Choose a drive with enough free space.',
    '约 25 GB（PyTorch 与模型），请选择空间充足的磁盘。',
    '~25 GB (PyTorch + modeller). Boş alanı bol bir diskte olmalı.'
  ],
  'settings.unrealConnection': ['Unreal Engine connection', 'Unreal Engine 连接', 'Unreal Engine bağlantısı'],
  'settings.findUnreal': ['Find Unreal', '查找 Unreal', 'Unreal’ı bul'],
  'settings.unrealNotFound': [
    'No open Unreal Editor found (is Remote Execution or Unreal MCP enabled?)',
    '未发现已打开的 Unreal 编辑器（是否启用了 Remote Execution 或 Unreal MCP？）',
    'Açık Unreal Editor bulunamadı (Remote Execution ya da Unreal MCP açık mı?)'
  ],
  'settings.unrealUrl': ['Unreal MCP URL', 'Unreal MCP 地址', 'Unreal MCP adresi'],
  'settings.unrealUrlHelp': ['Fallback when Remote Execution is unavailable; leave empty to disable', 'Remote Execution 不可用时使用；留空禁用', 'Remote Execution yoksa yedek yol; boş = kullanma'],
  'settings.ikRig': ['Manny/Quinn IK Rig path', 'Manny/Quinn IK Rig 路径', 'Manny/Quinn IK Rig yolu'],
  'settings.ikRigHelp': [
    'Characters retarget from this IK Rig (default in the UE5 Third Person template)',
    '角色从此 IK Rig 重定向（UE5 第三人称模板默认值）',
    'Karakterler bu IK Rig’ten retarget alır (UE5 Third Person şablonundaki varsayılan)'
  ],
  'settings.generatedAssets': ['Generated assets', '生成的资源', 'Üretilen asset’ler'],
  'settings.assetsOwnership': [
    'Yours; subject to the terms of the generating services (Meshy, ElevenLabs…)',
    '归你所有；须遵守生成服务（Meshy、ElevenLabs 等）的条款',
    'Sizindir; onları üreten servislerin (Meshy, ElevenLabs…) koşullarına tabidir'
  ],
  'settings.licenseSummary': [
    'GNU AGPL-3.0 — free and open source, including commercial game projects',
    'GNU AGPL-3.0 — 免费开源，包括商业游戏项目',
    'GNU AGPL-3.0 — ücretsiz ve açık kaynak, ticari oyun projeleri dahil'
  ],
  'settings.keys': ['Keys', '密钥', 'Anahtarlar'],
  'settings.keysProtection': ['Encrypted on this computer with Windows DPAPI', '使用 Windows DPAPI 在此计算机加密', 'Windows DPAPI ile bu bilgisayarda şifreli'],
  'settings.reportIssue': ['Report an issue', '报告问题', 'Sorun bildir'],
  'settings.releaseNotes': ['Release notes', '版本说明', 'Sürüm notları'],
  'settings.licenseText': ['License text', '许可证正文', 'Lisans metni'],
  'settings.thirdParty': ['Third-party licenses', '第三方许可证', 'Üçüncü taraf lisansları'],
  'settings.commercial': ['Commercial license', '商业许可证', 'Ticari lisans'],
  'settings.reporting': ['Reporting problems', '问题报告', 'Sorun bildirme'],
  'settings.saveDiagnostics': ['Save diagnostics file', '保存诊断文件', 'Tanılama dosyası kaydet'],
  'settings.openLogs': ['Open log folder', '打开日志目录', 'Günlük klasörünü aç'],
  'settings.reportBug': ['Report a bug', '报告错误', 'Hata bildir'],
  'settings.diagnosticsSaved': ['Diagnostics saved: {file}', '诊断文件已保存：{file}', 'Tanılama dosyası kaydedildi: {file}'],
  'settings.diagnosticsFailed': ['Could not save diagnostics: {detail}', '无法保存诊断文件：{detail}', 'Tanılama dosyası kaydedilemedi: {detail}']
} as const

function column<I extends 0 | 1 | 2>(index: I): { [K in keyof typeof rows]: (typeof rows)[K][I] } {
  return Object.fromEntries(Object.entries(rows).map(([key, values]) => [key, values[index]])) as { [K in keyof typeof rows]: (typeof rows)[K][I] }
}
export const extraEn = column(0)
export const extraZh = column(1)
export const extraTr = column(2)
