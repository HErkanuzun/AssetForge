// SPDX-License-Identifier: AGPL-3.0-only
export const errorRows = {
  'error.0d2583f764': ['Pipeline not found', '找不到流水线', 'Pipeline bulunamadı'],
  'error.d7702d95c6': ['No assets selected to run', '未选择要运行的资源', 'Çalıştırılacak asset seçilmedi'],
  'error.dbd417da03': ['Canceled', '已取消', 'İptal edildi'],
  'error.59ed3cb458': ['Pipeline contains a cycle (a node connects back to itself)', '流水线包含循环（节点回连自身）', 'Pipeline döngü içeriyor (bir node kendine geri bağlanmış)'],
  'error.088deaf40c': ['Brief not found', '找不到需求简报', 'Brief bulunamadı'],
  'error.989087d99f': ['Provider not found', '找不到提供商', 'Sağlayıcı bulunamadı'],
  'error.603cefc2ee': ['Enable the web server first', '请先启用 Web 服务器', 'Önce web sunucusunu açın'],
  'error.e54eb7ad68': ['Workflow is empty', '工作流为空', 'Workflow boş'],
  'error.98d0194e4b': ['Workflow not found', '找不到工作流', 'Workflow bulunamadı'],
  'error.67fed85b99': ['Backend not found: {p0}', '找不到后端：{p0}', 'Arka uç bulunamadı: {p0}'],
  'error.eb1a60c656': ['uv not found: install it from https://docs.astral.sh/uv/', '找不到 uv：请从 https://docs.astral.sh/uv/ 安装', 'uv bulunamadı: https://docs.astral.sh/uv/ adresinden kurun'],
  'error.bb3c580c02': [
    'Could not install uv; install manually from https://docs.astral.sh/uv/',
    '无法安装 uv；请从 https://docs.astral.sh/uv/ 手动安装',
    'uv kurulamadı; https://docs.astral.sh/uv/ adresinden elle kurun'
  ],
  'error.96a086fbd8': ['Command failed (code {p0}): {p1}', '命令失败（代码 {p0}）：{p1}', 'Komut başarısız (kod {p0}): {p1}'],
  'error.0dcc54bbac': [
    'git {p0} failed (code {p1}). Is Git installed and the URL correct?',
    'git {p0} 失败（代码 {p1}）。请检查 Git 是否已安装、地址是否正确。',
    'git {p0} başarısız (kod {p1}). Git kurulu mu, adres doğru mu?'
  ],
  'error.eb2e72b00d': [
    'Enter a valid git URL (https://github.com/user/project)',
    '请输入有效的 Git 地址（https://github.com/user/project）',
    'Geçerli bir git adresi girin (https://github.com/kullanıcı/proje)'
  ],
  'error.6920d42843': ['Port {p0} is used by another backend', '端口 {p0} 已被其他后端使用', 'Port {p0} başka bir arka uçta kullanılıyor'],
  'error.b0efe7cef7': ['Could not create virtual environment (uv venv)', '无法创建虚拟环境（uv venv）', 'Sanal ortam oluşturulamadı (uv venv)'],
  'error.f8f6c50f1f': [
    '“{p0}” is not installed yet (Settings → Local tools → Custom backends → Install)',
    '尚未安装“{p0}”（设置 → 本地工具 → 自定义后端 → 安装）',
    '“{p0}” henüz kurulmadı (Ayarlar → Yerel araçlar → Özel arka uçlar → Kur)'
  ],
  'error.ae8e6b3018': ['“{p0}” did not start. Last log: {p1}', '“{p0}”启动失败。最后日志：{p1}', '“{p0}” açılmadı. Son günlük: {p1}'],
  'error.6b8b6a773a': [
    'ComfyUI workflow not found: {p0}. Select a workflow from the library in the node.',
    '找不到 ComfyUI 工作流：{p0}。请在节点中选择工作流库里的工作流。',
    'ComfyUI workflow bulunamadı: {p0}. Düğümde kitaplıktan bir workflow seçin.'
  ],
  'error.2fa7479d96': ['Could not read recipe JSON: {p0}', '无法读取配方 JSON：{p0}', 'Tarif JSON okunamadı: {p0}'],
  'error.24b57090d1': ['Recipe must be a JSON object', '配方必须是 JSON 对象', 'Tarif bir JSON nesnesi olmalı'],
  'error.8c39657e41': ['Recipe has no valid “repo” (HTTPS git URL)', '配方缺少有效的“repo”（HTTPS Git 地址）', 'Tarifte geçerli bir "repo" (https git adresi) yok'],
  'error.a955c0f3ba': ['Recipe has no “start” command', '配方缺少“start”启动命令', 'Tarifte "start" (başlatma komutu) yok'],
  'error.dac1f55433': ['“port” must be a number from 1024 to 65535', '“port”必须是 1024–65535 之间的数字', '"port" 1024–65535 arasında bir sayı olmalı'],
  'error.a2689fb329': ['“api” must be gradio or http', '“api”必须为 gradio 或 http', '"api" gradio ya da http olmalı'],
  'error.7c6ac7bd11': [
    '“python” must be a version such as 3.10, 3.11 or 3.12 (empty = no virtual environment)',
    '“python”必须是 3.10、3.11、3.12 等版本号（留空不使用虚拟环境）',
    '"python" 3.10, 3.11, 3.12 gibi bir sürüm olmalı (boş = sanal ortam yok)'
  ],
  'error.79dc95487b': ['Unsupported model format: {p0}', '不支持的模型格式：{p0}', 'Desteklenmeyen model formatı: {p0}'],
  'error.989413d166': ['Quality control threshold was not met in {p0} attempts', '尝试 {p0} 次后仍未达到质量检查阈值', 'Kalite kontrol: {p0} denemede eşik aşılamadı'],
  'error.f82fde6a4e': ['BVH: expected a number ({p0})', 'BVH：应为数字（{p0}）', 'BVH: sayı bekleniyordu ({p0})'],
  'error.96e4567b41': ['BVH: does not start with HIERARCHY', 'BVH：未以 HIERARCHY 开头', 'BVH: HIERARCHY ile başlamıyor'],
  'error.ecf976cc65': ['BVH: expected an opening brace for {p0}', 'BVH：{p0} 后应为左花括号', 'BVH: {p0} için { bekleniyordu'],
  'error.6d4283ce13': ['BVH: unexpected “{p0}”', 'BVH：意外的“{p0}”', 'BVH: beklenmeyen "{p0}"'],
  'error.d3fda3edda': ['BVH: missing “Frames:”', 'BVH：缺少“Frames:”', 'BVH: "Frames:" yok'],
  'error.302667c8eb': ['BVH: missing “Frame Time:”', 'BVH：缺少“Frame Time:”', 'BVH: "Frame Time:" yok'],
  'error.c7dfef990d': ['Only files inside the project folder can be opened', '只能打开项目文件夹内的文件', 'Yalnızca proje klasöründeki dosyalar açılabilir'],
  'error.31751cf7f3': ['Only files inside the project folder can be revealed', '只能显示项目文件夹内的文件', 'Yalnızca proje klasöründeki dosyalar gösterilebilir'],
  'error.b82609472e': ['Download failed ({p0}): {p1}', '下载失败（{p0}）：{p1}', 'İndirme başarısız ({p0}): {p1}'],
  'error.c427563d3c': ['Conversation not found', '找不到对话', 'Sohbet bulunamadı'],
  'error.f1e81db02b': ['The assistant is still running', '助手仍在运行', 'Asistan hâlâ çalışıyor'],
  'error.a86199ebb6': ['This conversation’s provider was deleted; start a new conversation', '此对话的提供商已删除，请新建对话', 'Bu sohbetin sağlayıcısı silinmiş; yeni sohbet açın'],
  'error.99888e426c': ['Stopped.', '已停止。', 'Durduruldu.'],
  'error.a24ce9eae2': ['Connection timed out (30 s)', '连接超时（30 秒）', 'Bağlantı zaman aşımı (30 sn)'],
  'error.21cc9665d3': ['Server not found', '找不到服务器', 'Sunucu bulunamadı'],
  'error.3f8837c336': ['Only the output folder can be written to', '只能写入输出文件夹', 'Yalnızca çıktı klasörüne yazılabilir'],
  'error.0857601679': ['Selected LLM provider not found (Settings → AI)', '找不到所选 LLM 提供商（设置 → AI）', 'Seçilen LLM sağlayıcısı bulunamadı (Ayarlar → Yapay zekâ)'],
  'error.23c9bcd94a': ['Could not connect to MCP server: {p0}', '无法连接 MCP 服务器：{p0}', 'MCP sunucusuna bağlanılamadı: {p0}'],
  'error.61e6f775b5': ['Claude Code error code {p0}: {p1}', 'Claude Code 错误代码 {p0}：{p1}', 'Claude Code hata kodu {p0}: {p1}'],
  'error.a60e255375': ['Codex error code {p0}: {p1}', 'Codex 错误代码 {p0}：{p1}', 'Codex hata kodu {p0}: {p1}'],
  'error.6c2c49d4f0': ['New assets require name and kind', '新资源必须填写 name 和 kind', 'Yeni asset için name ve kind gerekli'],
  'error.2651fcc3c8': ['Character not found: {p0}', '找不到角色：{p0}', 'Karakter bulunamadı: {p0}'],
  'error.db85d491e7': ['Could not connect to {p0} ({p1}). Is the server running?', '无法连接 {p0}（{p1}）。请检查服务器是否运行。', '{p0} sunucusuna bağlanılamadı ({p1}). Sunucu açık mı?'],
  'error.7917776e07': ['{p0} error ({p1}): {p2}', '{p0} 错误（{p1}）：{p2}', '{p0} hatası ({p1}): {p2}'],
  'error.d336e93f09': ['The model returned no JSON', '模型未返回 JSON', 'Model JSON döndürmedi'],
  'error.aec3fd1b5b': ['{p0}: response did not match the schema', '{p0}：响应不符合结构要求', '{p0}: şemaya uygun yanıt alınamadı'],
  'error.56021ced56': ['Animation system not found: {p0}', '找不到动画系统：{p0}', 'Animasyon sistemi bulunamadı: {p0}'],
  'error.c49819d19c': ['System not found', '找不到系统', 'Sistem bulunamadı'],
  'error.771f304c25': ['This system is already generating', '此系统已在生成中', 'Bu sistem zaten üretiliyor'],
  'error.95b9215010': ['No generated clips to build. Generate all first.', '没有可搭建的已生成片段，请先生成全部。', 'Kurulacak üretilmiş klip yok. Önce “Hepsini üret”.'],
  'error.8a72ea71be': ['Input “{p0}” is disconnected or empty', '输入“{p0}”未连接或为空', '"{p0}" girişi bağlı değil veya boş'],
  'error.a35845ff21': ['Input “{p0}” expects {p1}, received {p2}', '输入“{p0}”需要 {p1}，收到 {p2}', '"{p0}" girişi {p1} bekliyor, {p2} geldi'],
  'error.fd560d637d': ['File path is empty', '文件路径为空', 'Dosya yolu boş'],
  'error.8ff271651a': ['File not found: {p0}', '找不到文件：{p0}', 'Dosya bulunamadı: {p0}'],
  'error.5d4e9cd4a7': ['Model exceeds Meshy’s 100 MB data URI limit', '模型超过 Meshy 的 100 MB data URI 限制', 'Model 100 MB üstünde; Meshy data URI sınırı aşılıyor'],
  'error.a20b827a78': ['Meshy job returned no model file', 'Meshy 任务未返回模型文件', 'Meshy görevi model dosyası döndürmedi'],
  'error.cfefdd8aff': [
    'BVH must be converted to FBX for Unreal. Set the Blender path in Settings → Local tools.',
    '导入 Unreal 前需将 BVH 转为 FBX。请在设置 → 本地工具中填写 Blender 路径。',
    'BVH’yi Unreal’a aktarmak için FBX’e çevirmek gerekiyor; Ayarlar → Yerel araçlar’dan Blender yolunu girin'
  ],
  'error.22cebce736': ['Meshy returned no image', 'Meshy 未返回图像', 'Meshy görsel döndürmedi'],
  'error.aa926c762a': [
    'ComfyUI returned no image (does the workflow contain Save Image?)',
    'ComfyUI 未返回图像（工作流中是否包含 Save Image 节点？）',
    'ComfyUI görsel döndürmedi (workflow’da Save Image düğümü var mı?)'
  ],
  'error.b8d2b9d4be': [
    'Gradio App: select a custom backend or enter the app URL',
    'Gradio 应用：请选择自定义后端或输入应用地址',
    'Gradio Uygulaması: bir özel arka uç seçin ya da uygulamanın adresini girin'
  ],
  'error.0c04977498': ['Fixed values are not valid JSON: {p0}', '固定值不是有效的 JSON：{p0}', '“Sabit değerler” geçerli JSON değil: {p0}'],
  'error.07b5f74175': ['Gradio app returned no image, model or audio{p0}', 'Gradio 应用未返回图像、模型或音频{p0}', 'Gradio uygulaması görsel, model ya da ses döndürmedi{p0}'],
  'error.7844c279f8': [
    'ComfyUI returned no output. Add a saving node such as Save Image, Save Audio or Save 3D.',
    'ComfyUI 未输出内容。工作流需包含 Save Image、Save Audio 或 Save 3D 等保存节点。',
    'ComfyUI çıktı vermedi. Workflow’da Save Image / Save Audio / Save 3D gibi bir kaydetme düğümü olmalı.'
  ],
  'error.1392539d67': [
    'No speech text: connect the Prompt Engine with the Voice line target or fill in Text',
    '缺少语音文本：请连接以语音台词为目标的提示词引擎，或填写文本字段',
    'Seslendirilecek metin yok: Prompt Motoru’nu (Ses Satırı hedefi) bağlayın ya da “Metin” alanını doldurun'
  ],
  'error.101077fa07': ['Task is empty: fill in Task or connect a Prompt', '任务为空：请填写任务字段或连接提示词', 'Görev boş: düğümün "Görev" alanına ne yapacağını yaz ya da bir Prompt bağla'],
  'error.1f2e324c6f': [
    'Agent did not save the expected {p0} file to output. Last message: {p1}',
    '代理未将预期的 {p0} 文件保存到输出目录。最后消息：{p1}',
    'Ajan beklenen {p0} dosyasını çıktı klasörüne kaydetmedi. Son mesajı: {p1}'
  ],
  'error.681e3b4d7a': ['Agent produced no files', '代理未生成文件', 'Ajan hiç dosya üretmedi'],
  'error.e3ac55d0a0': ['Manual plan is not valid JSON: {p0}', '手动方案不是有效的 JSON：{p0}', 'Elle plan geçerli JSON değil: {p0}'],
  'error.a90ca598f1': ['Agent did not complete assembly (missing assembly.json)', '代理未完成装配（缺少 assembly.json）', 'Ajan montajı tamamlamadı (assembly.json yok)'],
  'error.f83848e372': ['Meshy rig returned no file', 'Meshy 绑定未返回文件', 'Meshy rig sonucu dosya döndürmedi'],
  'error.5a9c612e2d': ['No input to review', '没有可检查的输入', 'İncelenecek girdi yok'],
  'error.6b2f765878': ['No input to export', '没有可导出的输入', 'Export edilecek girdi yok'],
  'error.1c33580c08': ['Export not supported: {p0}', '不支持导出：{p0}', 'Export desteklenmiyor: {p0}'],
  'error.f87eba91a5': ['Unknown node type: {p0}', '未知节点类型：{p0}', 'Bilinmeyen node tipi: {p0}'],
  'error.51f2049dd2': ['Unreal did not create a skeletal mesh', 'Unreal 未创建骨骼网格', 'Unreal iskeletli mesh oluşturmadı'],
  'error.ede393bd6f': [
    'Legacy .xls is unsupported. Save as .xlsx in Excel and retry.',
    '不支持旧版 .xls。请在 Excel 中另存为 .xlsx 后重试。',
    'Eski .xls biçimi desteklenmiyor. Dosyayı Excel’de .xlsx olarak kaydedip tekrar dene.'
  ],
  'error.6316742e4f': ['Uncompressed Excel file is too large (over 200 MB)', 'Excel 文件解压后过大（超过 200 MB）', 'Excel dosyası açıldığında çok büyük (200 MB üstü)'],
  'error.1a6a64c25f': ['Invalid .xlsx file (missing xl/workbook.xml)', '无效的 .xlsx 文件（缺少 xl/workbook.xml）', 'Geçerli bir .xlsx dosyası değil (xl/workbook.xml yok)'],
  'error.9f389a4386': ['Blender not found. Set its path in Settings → Blender.', '找不到 Blender。请在设置中填写 Blender 路径。', 'Blender bulunamadı. Ayarlar → Blender yolu'],
  'error.c3db04df62': ['Unknown step: {p0}', '未知步骤：{p0}', 'Bilinmeyen adım: {p0}'],
  'error.9788919755': [
    'The “This computer” address points elsewhere. Installation requires a local address (127.0.0.1).',
    '“本机”记录的地址指向其他电脑。安装只能在本地地址（127.0.0.1）进行。',
    '“Bu bilgisayar” kaydının adresi bu bilgisayarı göstermiyor; kurulum yalnızca yerel adreste (127.0.0.1) yapılabilir.'
  ],
  'error.a9b3594556': ['ComfyUI step failed ({p0}). See output above.', 'ComfyUI 步骤失败（{p0}）。详情见上方输出。', 'ComfyUI adımı başarısız ({p0}). Ayrıntı yukarıdaki çıktıda.'],
  'error.808567535b': [
    'ComfyUI did not start within {p0} s ({p1}). Last log: {p2}',
    'ComfyUI 未能在 {p0} 秒内启动（{p1}）。最后日志：{p2}',
    'ComfyUI {p0} sn içinde açılmadı ({p1}). Son günlük: {p2}'
  ],
  'error.a33e9098f2': ['Could not reach ComfyUI ({p0}). Is the remote server running?', '无法连接 ComfyUI（{p0}）。请检查远程服务器是否运行。', "ComfyUI'a ulaşılamadı ({p0}). Uzak sunucu açık mı?"],
  'error.273642f7a1': [
    'ComfyUI is offline and not installed here. Run Install in Settings → Local tools → ComfyUI, or start your own ComfyUI.',
    'ComfyUI 离线且本机未安装。请在设置 → 本地工具 → ComfyUI 中执行安装，或启动自己的 ComfyUI。',
    'ComfyUI kapalı ve bu bilgisayarda kurulu değil. Ayarlar → Yerel araçlar → ComfyUI’dan “Kur” adımlarını çalıştırın ya da kendi ComfyUI’ınızı açın.'
  ],
  'error.c101436576': [
    'Could not start ComfyUI (Settings → Local tools → ComfyUI → Logs)',
    '无法启动 ComfyUI（设置 → 本地工具 → ComfyUI → 日志）',
    'ComfyUI başlatılamadı (Ayarlar → Yerel araçlar → ComfyUI → Günlük)'
  ],
  'error.c57854ddda': ['Address is empty', '地址为空', 'Adres boş'],
  'error.b9380d2734': [
    'ComfyUI server “{p0}” is disabled in Settings. Enable it or select another server.',
    'ComfyUI 服务器“{p0}”已在设置中禁用。请启用或选择其他服务器。',
    'ComfyUI sunucusu “{p0}” Ayarlar’da kapalı. Açın ya da düğümde başka bir sunucu seçin.'
  ],
  'error.fda3a97dbf': [
    '“{p0}” cannot run this workflow — {p1}. Install missing components in ComfyUI Manager or select another server / Automatic.',
    '“{p0}”无法运行此工作流：{p1}。请在 ComfyUI Manager 安装缺失组件，或选择其他服务器／自动。',
    '“{p0}” bu workflow’u çalıştıramaz — {p1}. ComfyUI Manager’dan eksikleri kurun ya da düğümde başka bir sunucu / Otomatik seçin.'
  ],
  'error.2afd2324bf': [
    'No enabled ComfyUI server. Add or enable one in Settings → Local tools → ComfyUI.',
    '没有启用的 ComfyUI 服务器。请在设置 → 本地工具 → ComfyUI 中添加或启用。',
    'Etkin ComfyUI sunucusu yok. Ayarlar → Yerel araçlar → ComfyUI’dan bir sunucu ekleyin ya da açın.'
  ],
  'error.1ef8ce61f0': ['No ComfyUI server can run this workflow — {p0}', '没有服务器能运行此 ComfyUI 工作流：{p0}', 'Bu workflow’u çalıştırabilecek ComfyUI sunucusu yok — {p0}'],
  'error.e578d0b9c1': ['Step failed ({p0}, code {p1})', '步骤失败（{p0}，代码 {p1}）', 'Adım başarısız ({p0}, kod {p1})'],
  'error.b95c90c1ad': [
    'BIOS virtualization is disabled (AMD SVM / Intel VT-x). Enable it after restarting, or use the Native Windows Kimodo backend.',
    'BIOS 虚拟化已禁用（AMD SVM / Intel VT-x）。请重启后启用，或使用 Kimodo 原生 Windows 后端。',
    'BIOS’ta sanallaştırma kapalı (AMD: SVM Mode, Intel: VT-x). Bilgisayarı yeniden başlatıp BIOS’tan açın ya da Kimodo’yu "Yerel Windows" yoluyla çalıştırın.'
  ],
  'error.80e29ab4e4': [
    'Could not install Ubuntu. Windows may require a restart; retry this step afterward.',
    '无法安装 Ubuntu。Windows 可能需要重启，请重启后重试此步骤。',
    'Ubuntu kurulamadı; Windows yeniden başlatma isteyebilir. Yeniden başlattıktan sonra adımı tekrarlayın.'
  ],
  'error.d56fa01588': [
    'Kimodo service is offline. Animation Studio → Kimodo setup → Start service.',
    'Kimodo 服务未运行。请前往动画工作室 → Kimodo 安装 → 启动服务。',
    'Kimodo servisi çalışmıyor. Animasyon Stüdyosu → Kimodo kurulumu → "Servisi başlat"'
  ],
  'error.9b62ddecad': [
    'No running Unreal Editor found (is Python Remote Execution enabled?)',
    '找不到运行中的 Unreal 编辑器（是否启用 Python Remote Execution？）',
    'Açık bir Unreal Editor bulunamadı (Python Remote Execution açık mı?)'
  ],
  'error.52b53b30c4': ['Unreal did not open a command connection', 'Unreal 未打开命令连接', 'Unreal komut bağlantısı açmadı'],
  'error.9808b7bb7d': ['Unreal command timed out', 'Unreal 命令超时', 'Unreal komutu zaman aşımına uğradı'],
  'error.95e1b4bfa1': ['Unreal MCP URL is not configured (Settings → Unreal Engine)', '未配置 Unreal MCP 地址（设置 → Unreal Engine）', 'Unreal MCP adresi ayarlı değil (Ayarlar → Unreal Engine)'],
  'error.a7125efc70': ['Unreal MCP server did not respond', 'Unreal MCP 服务器未响应', 'Unreal MCP sunucusu yanıt vermedi'],
  'error.b903dc635d': [
    'Unreal MCP has no Python execution tool (e.g. ExecutePython)',
    'Unreal MCP 服务器没有 Python 执行工具（例如 ExecutePython）',
    'Unreal MCP sunucusunda Python çalıştıran bir araç yok (ör. ExecutePython)'
  ],
  'error.efab7543d3': [
    'No running Unreal Editor: Remote Execution did not respond; MCP: {p0}',
    '找不到运行中的 Unreal 编辑器：Remote Execution 未响应；MCP：{p0}',
    'Açık bir Unreal Editor bulunamadı: Remote Execution yanıt vermedi, MCP: {p0}'
  ],
  'error.1ded2ead6e': [
    'Unreal Agent Skill tools are unavailable (are Unreal MCP and Toolset Registry plugins enabled?)',
    'Unreal Agent Skill 工具不可用（是否启用了 Unreal MCP 和 Toolset Registry 插件？）',
    'Unreal’da Agent Skill araç seti yok (Unreal MCP ve Toolset Registry eklentisi açık mı?)'
  ],
  'error.97785b3cc5': ['This brief is already waiting for a response', '此需求简报已在等待响应', 'Bu brief zaten yanıt bekliyor'],
  'error.b28e968b88': ['Message is empty', '消息为空', 'Boş mesaj'],
  'error.6a8c1a076b': ['Invalid Claude API key (Settings)', 'Claude API 密钥无效（设置）', 'Claude API anahtarı geçersiz (Ayarlar)'],
  'error.0b9c433879': ['Claude: no permission for this model/feature', 'Claude：无权使用此模型或功能', 'Claude: bu model/özellik için yetki yok'],
  'error.6a7fdead89': ['Claude model not found: {p0}', '找不到 Claude 模型：{p0}', 'Claude modeli bulunamadı: {p0}'],
  'error.97b215a2fd': [
    'Claude rate limit exceeded; retry later or reduce concurrency',
    '超出 Claude 请求限制；请稍后重试或减少并发任务数',
    'Claude istek sınırı aşıldı; biraz sonra tekrar deneyin veya eşzamanlı iş sayısını düşürün'
  ],
  'error.59c10f1ecb': ['Could not connect to Claude (check internet connection)', '无法连接 Claude（请检查网络）', 'Claude sunucusuna bağlanılamadı (internet bağlantısı?)'],
  'error.d90aabf4b3': ['Claude error ({p0}): {p1}', 'Claude 错误（{p0}）：{p1}', 'Claude hatası ({p0}): {p1}'],
  'error.ec530f9bc3': ['Claude API key is missing (Settings → Claude)', '缺少 Claude API 密钥（设置 → Claude）', 'Claude API anahtarı girilmemiş (Ayarlar → Claude)'],
  'error.fe7214a1e7': ['Claude refused the request{p0}', 'Claude 拒绝了请求{p0}', 'Claude isteği reddetti{p0}'],
  'error.181c61c61f': ['Claude response reached the token limit', 'Claude 响应达到令牌上限而被截断', 'Claude yanıtı token sınırında kesildi'],
  'error.01f6124de9': ['Claude returned no structured response', 'Claude 未返回结构化响应', 'Claude yapılandırılmış yanıt döndürmedi'],
  'error.603b952879': ['Unknown prompt target: {p0}', '未知提示词目标：{p0}', 'Bilinmeyen prompt hedefi: {p0}'],
  'error.2079758561': ['Could not generate prompt', '无法生成提示词', 'Prompt üretilemedi'],
  'error.36a824f6e2': ['Could not read workflow JSON: {p0}', '无法读取工作流 JSON：{p0}', 'Workflow JSON okunamadı: {p0}'],
  'error.5b027d01f3': [
    'This is ComfyUI’s UI format. Save with Workflow → Export (API) and select that file.',
    '此文件为 ComfyUI 界面格式。请通过 Workflow → Export (API) 导出后选择该文件。',
    'Bu dosya ComfyUI’ın arayüz formatında. ComfyUI’da Workflow → Export (API) ile kaydedip onu seçin.'
  ],
  'error.997b23c8f1': ['Workflow has no nodes (is it in API format?)', '工作流中没有节点（是否为 API 格式？）', 'Workflow’da düğüm yok (API formatında mı?)'],
  'error.3219e80276': ['Could not reach ComfyUI ({p0}) — {p1}. Is ComfyUI running?', '无法连接 ComfyUI（{p0}）：{p1}。请检查是否运行。', "ComfyUI'a ulaşılamadı ({p0}) — {p1}. ComfyUI açık mı?"],
  'error.e2de6ebd9a': ['Owner account cannot be deleted', '无法删除所有者账号', 'Sahip hesabı silinemez'],
  'error.523742afd8': ['User not found', '找不到用户', 'Kullanıcı bulunamadı'],
  'error.32d3ce76ec': ['Owner role cannot be changed', '无法更改所有者角色', 'Sahip rolü değiştirilemez'],
  'error.bebd706ab9': ['Request is too large', '请求过大', 'İstek çok büyük'],
  'error.126e8c21fe': ['Not a file', '不是文件', 'dosya değil'],
  'error.c0e5081db6': ['File is too large (maximum 2 GB)', '文件过大（最大 2 GB）', 'Dosya çok büyük (en fazla 2 GB)'],
  'error.a84d04cf10': ['{p0}: no result received from Unreal {p1}', '{p0}：未收到 Unreal 结果 {p1}', "{p0}: Unreal'dan sonuç gelmedi {p1}"],
  'error.b1bb97e6d3': ['Blender assembly step ({p0}) failed: {p1}', 'Blender 装配步骤（{p0}）失败：{p1}', 'Blender montaj adımı ({p0}) başarısız: {p1}'],
  'error.e607900829': ['ComfyUI denied access ({p0}) — check the token', 'ComfyUI 拒绝访问（{p0}），请检查令牌', 'ComfyUI erişimi reddetti ({p0}) — token doğru mu?'],
  'error.a72a539b3c': ['ComfyUI response {p0}', 'ComfyUI 响应 {p0}', 'ComfyUI yanıtı {p0}'],
  'error.11e5bf4ed7': ['The server at this address is not ComfyUI', '此地址的服务器不是 ComfyUI', 'Bu adresteki sunucu ComfyUI değil'],
  'error.ab5d628a7b': ['ComfyUI rejected the file ({p0}): {p1}', 'ComfyUI 拒绝了文件（{p0}）：{p1}', 'ComfyUI dosyayı kabul etmedi ({p0}): {p1}'],
  'error.84bcd5db15': ['ComfyUI workflow not found: {p0}', '找不到 ComfyUI 工作流：{p0}', 'ComfyUI workflow bulunamadı: {p0}'],
  'error.350abacb7d': ['ComfyUI rejected the workflow: {p0}', 'ComfyUI 拒绝了工作流：{p0}', "ComfyUI workflow'u reddetti: {p0}"],
  'error.9350b456a0': ['ComfyUI workflow failed{p0}', 'ComfyUI 工作流失败{p0}', 'ComfyUI workflow hata verdi{p0}'],
  'error.d6534994ee': ['ComfyUI timed out ({p0} min)', 'ComfyUI 超时（{p0} 分钟）', 'ComfyUI zaman aşımı ({p0} dk)'],
  'error.7a2a97c3e1': ['Could not download ComfyUI output: {p0} ({p1})', '无法下载 ComfyUI 输出：{p0}（{p1}）', 'ComfyUI çıktısı indirilemedi: {p0} ({p1})'],
  'error.252fcccc06': ['Design agent could not produce valid JSON: {p0}', '设计代理无法生成有效的 JSON：{p0}', 'Tasarım ajanı geçerli JSON üretemedi: {p0}'],
  'error.3335f327a5': ['ElevenLabs API key is missing (Settings)', '缺少 ElevenLabs API 密钥（设置）', 'ElevenLabs API anahtarı yok (Ayarlar)'],
  'error.8f5ccf0b5c': [
    'Could not reach Gradio app ({p0}) — {p1}. Is it running?',
    '无法连接 Gradio 应用（{p0}）：{p1}。请检查应用是否运行。',
    'Gradio uygulamasına ulaşılamadı ({p0}) — {p1}. Uygulama açık mı?'
  ],
  'error.a39b4923a4': [
    'No Gradio API found at this address ({p0}, response {p1}). Requires Gradio 4+; the app may have disabled its API.',
    '此地址未找到 Gradio API（{p0}，响应 {p1}）。需要 Gradio 4 或更高版本；应用可能禁用了 API。',
    'Bu adreste Gradio API’si bulunamadı ({p0}, yanıt {p1}). Gradio 4 veya üstü gerekir; uygulamada API kapalı olabilir.'
  ],
  'error.524724813d': ['Gradio rejected the file ({p0}): {p1}', 'Gradio 拒绝了文件（{p0}）：{p1}', 'Gradio dosyayı kabul etmedi ({p0}): {p1}'],
  'error.ee01f7820d': ['Gradio app has no API endpoints enabled', 'Gradio 应用未开放 API 端点', 'Gradio uygulamasında API’ye açık uç nokta yok'],
  'error.35bbac76ba': ['Gradio endpoint “{p0}” not found. Available: {p1}', '找不到 Gradio 端点“{p0}”。可用端点：{p1}', 'Gradio uç noktası “{p0}” yok. Var olanlar: {p1}'],
  'error.06621ac878': ['Gradio rejected the request ({p0}): {p1}', 'Gradio 拒绝了请求（{p0}）：{p1}', 'Gradio isteği reddetti ({p0}): {p1}'],
  'error.d7ecc2e675': ['Gradio timed out ({p0} min)', 'Gradio 超时（{p0} 分钟）', 'Gradio zaman aşımı ({p0} dk)'],
  'error.ffdc6a020b': ['Gradio app failed{p0}', 'Gradio 应用出错{p0}', 'Gradio uygulaması hata verdi{p0}'],
  'error.72d169e3f4': ['Could not download Gradio output ({p0}): {p1}', '无法下载 Gradio 输出（{p0}）：{p1}', 'Gradio çıktısı indirilemedi ({p0}): {p1}'],
  'error.0edb8a41c7': ['HTTP {p0}: could not connect ({p1})', 'HTTP {p0}：无法连接（{p1}）', 'HTTP {p0}: sunucuya bağlanılamadı ({p1})'],
  'error.8679632661': ['HTTP {p0} error ({p1}): {p2}', 'HTTP {p0} 错误（{p1}）：{p2}', 'HTTP {p0} hatası ({p1}): {p2}'],
  'error.b6cff0b4c4': ['Invalid HTTP URL: {p0}', 'HTTP 地址无效：{p0}', 'HTTP adresi geçersiz: {p0}'],
  'error.573d0d715d': [
    'Request body is not valid JSON after placeholder substitution: {p0}',
    '替换占位符后请求体不是有效的 JSON：{p0}',
    'İstek gövdesi geçerli JSON değil (yer tutucular doldurulduktan sonra): {p0}'
  ],
  'error.dbcdf368ef': [
    'Multipart body requires a {p0} file, but {p1} is not connected',
    '多部分请求体需要 {p0} 文件，但节点未连接 {p1}',
    'Çok parçalı gövde {p0} dosyası istiyor ama düğüme {p1} bağlı değil'
  ],
  'error.57969c4343': ['Response has no job ID ({p0}): {p1}', '响应缺少任务 ID（{p0}）：{p1}', 'Yanıtta iş kimliği yok ({p0}): {p1}'],
  'error.0025ea5e12': ['Job failed ({p0}): {p1}', '任务失败（{p0}）：{p1}', 'İş başarısız ({p0}): {p1}'],
  'error.eda976c0e7': ['HTTP job timed out ({p0} min), last status: {p1}', 'HTTP 任务超时（{p0} 分钟），最后状态：{p1}', 'HTTP işi zaman aşımı ({p0} dk), son durum: {p1}'],
  'error.2a0661c5e4': [
    'Response is JSON. Set Result path to the file field (e.g. data.0.url).',
    '响应为 JSON。请在结果路径中填写文件所在路径（例如 data.0.url）。',
    'Yanıt JSON; “Sonuç yolu” alanına dosyanın bulunduğu yolu yazın (ör. data.0.url)'
  ],
  'error.92017392a8': ['No file at response path “{p0}”: {p1}', '响应路径“{p0}”处没有文件：{p1}', 'Yanıtta “{p0}” yolunda dosya yok: {p1}'],
  'error.ce77ead35d': ['Unrecognized result (not a URL, data: or base64): {p0}', '无法识别结果（不是 URL、data: 或 base64）：{p0}', 'Sonuç tanınmadı (adres, data: ya da base64 değil): {p0}'],
  'error.51df629f9b': ['Meshy API key is missing (Settings)', '缺少 Meshy API 密钥（设置）', 'Meshy API anahtarı yok (Ayarlar)'],
  'error.57ec37d6f7': ['Meshy job {p0}: {p1}', 'Meshy 任务 {p0}：{p1}', 'Meshy görevi {p0}: {p1}'],
  'error.c4b4beb00e': ['Meshy job timed out ({p0})', 'Meshy 任务超时（{p0}）', 'Meshy görevi zaman aşımına uğradı ({p0})'],
  'error.4d5e8e0509': [
    '{p0}: could not connect for {p1} ({p2}). Is the server running?',
    '{p0}：无法连接以执行 {p1}（{p2}）。请检查服务器是否运行。',
    '{p0}: {p1} için sunucuya bağlanılamadı ({p2}). Sunucu açık mı?'
  ],
  'error.2941411f5b': ['{p0} {p1} error ({p2}){p3}: {p4}', '{p0} {p1} 错误（{p2}）{p3}：{p4}', '{p0} {p1} hatası ({p2}){p3}: {p4}'],
  'error.811d4231f8': ['Could not download image ({p0})', '无法下载图像（{p0}）', 'Görsel indirilemedi ({p0})'],
  'error.4e40e93e77': ['{p0} returned no images', '{p0} 未返回图像', '{p0} görsel döndürmedi'],
  'error.cab177fde8': ['{p0} returned empty audio', '{p0} 返回了空音频', '{p0} boş ses döndürdü']
} as const
