// SPDX-License-Identifier: AGPL-3.0-only
import { qaRows } from './qa'
import { errorRows } from './appErrors'
import { logRows } from './logs'
import { templateRows } from './templates'
export const feedbackRows = {
  'comfy.workflowFilter': ['ComfyUI workflow (API)', 'ComfyUI 工作流（API）', 'ComfyUI iş akışı (API)'],
  ...templateRows,
  'comfy.localManaged': ['This computer (AssetForge installation)', '本机（AssetForge 安装）', 'Bu bilgisayar (AssetForge kurulumu)'],
  'comfy.local': ['This computer', '本机', 'Bu bilgisayar'],
  'comfy.remote': ['Remote ComfyUI', '远程 ComfyUI', 'Uzak ComfyUI'],
  'qa.overBudget': ['Triangle count greatly exceeds budget ({count} > {budget})', '三角面数严重超出预算（{count} > {budget}）', 'Üçgen sayısı bütçenin çok üstünde ({count} > {budget})'],
  'qa.noUv': ['No UVs', '缺少 UV', 'UV yok'],
  'feedback.consoleHint': [' (see the application console)', '（请查看应用控制台）', ' (uygulamanın konsoluna bakın)'],
  'feedback.comfyConsoleHint': [' (see the ComfyUI console)', '（请查看 ComfyUI 控制台）', ' (ComfyUI konsoluna bakın)'],
  'feedback.textDetail': [' (text: {text})', '（文本：{text}）', ' (metin: {text})'],
  'meshy.queued': ['Queued ({count} tasks ahead)', '排队中（前面有 {count} 个任务）', 'sırada ({count} görev önde)'],
  'motion.measurement': [
    'Measured: {seconds} s, speed {speed} m/s, direction {direction}°, turn {turn}°',
    '实测：{seconds} 秒，速度 {speed} 米/秒，方向 {direction}°，转向 {turn}°',
    'Ölçüm: {seconds} sn, hız {speed} m/sn, yön {direction}°, dönüş {turn}°'
  ],
  'motion.loopMeasurement': ['loop frames {start}→{end} (difference {cost})', '循环帧 {start}→{end}（差值 {cost}）', 'döngü {start}→{end}. kare (fark {cost})'],
  'motion.contacts': ['foot contacts L {left} / R {right}', '足部触地 左 {left} / 右 {right}', 'basışlar L {left} / R {right}'],
  'qa.modelTriangles': ['Triangles: {count} (budget {budget})', '三角面：{count}（预算 {budget}）', 'Üçgen: {count} (bütçe {budget})'],
  'qa.modelUv': ['UVs present: {value}', '包含 UV：{value}', 'UV var: {value}'],
  'qa.modelBounds': ['Bounding box (m): {dimensions} — brief size: {size}', '包围盒（米）：{dimensions} — 简报尺寸：{size}', 'Sınır kutusu (m): {dimensions} — brief ölçüsü: {size}'],
  'qa.modelObjects': [
    'Mesh objects: {objects}, materials: {materials}, rigged: {rigged}',
    '网格对象：{objects}，材质：{materials}，已绑定：{rigged}',
    'Mesh nesneleri: {objects}, malzemeler: {materials}, rig: {rigged}'
  ],
  'feedback.none': ['none', '无', 'yok'],
  'feedback.test': ['Test', '测试', 'Test et'],
  'feedback.tokenSaved': ['Token saved', '令牌已保存', 'Token kaydedildi'],
  'feedback.tokenRemoved': ['Token removed', '令牌已删除', 'Token silindi'],
  'feedback.exampleName': ['e.g. Deniz', '例如：小明', 'ör. Deniz'],
  'feedback.kitSuffix': [' · kit', ' · 套件', ' · kit'],
  'feedback.join': ['{left} · {right}', '{left} · {right}', '{left} · {right}'],
  'comfy.fitOffline': ['Offline ({detail})', '离线（{detail}）', 'kapalı ({detail})'],
  'comfy.fitSuitable': ['Compatible', '兼容', 'uygun'],
  'comfy.serverOffline': [
    'ComfyUI server “{name}” is not responding ({url}). {detail}',
    'ComfyUI 服务器“{name}”未响应（{url}）。{detail}',
    'ComfyUI sunucusu “{name}” yanıt vermiyor ({url}). {detail}'
  ],
  'backend.noteTorch': [
    'PyTorch uses CUDA 12.8; change this command if the repository requires another version.',
    'PyTorch 使用 CUDA 12.8；若仓库要求其他版本，请修改此命令。',
    'PyTorch CUDA 12.8 sürümüyle kurulur; depo başka bir sürüm istiyorsa bu satırı değiştirin.'
  ],
  'backend.noteRequirements': [
    'No requirements.txt / pyproject.toml found; write installation commands using the README.',
    '找不到 requirements.txt / pyproject.toml，请参照 README 填写安装命令。',
    'requirements.txt / pyproject.toml bulunamadı: kurulum komutlarını README’ye bakarak yazın.'
  ],
  'backend.noteStart': [
    'No entry file found (app.py, demo.py …); write the start command using the README.',
    '找不到启动文件（app.py、demo.py 等），请参照 README 填写 start 命令。',
    'Başlatma dosyası bulunamadı (app.py, demo.py …): "start" komutunu README’ye bakarak yazın.'
  ],
  'backend.noteServer': [
    'No Gradio or HTTP server detected. A command-line project needs a server wrapper first.',
    '未检测到 Gradio 或 HTTP 服务器。仅支持命令行的项目需要先添加服务器接口。',
    'Gradio ya da HTTP sunucusu görünmüyor: proje yalnızca komut satırından çalışıyorsa önce küçük bir sunucu sarmalayıcı gerekir.'
  ],
  'backend.notePort': [
    'Gradio receives its port through GRADIO_SERVER_PORT; if the app fixes its own port, adjust the port field.',
    'Gradio 通过 GRADIO_SERVER_PORT 接收端口；若应用固定了端口，请相应修改 port 字段。',
    'Gradio portu GRADIO_SERVER_PORT ortam değişkeniyle verilir; uygulama kendi portunu sabitliyorsa "port" alanını ona göre değiştirin.'
  ],
  'backend.noteOwn': [
    'Using the repository’s {file} recipe. Review commands before installing.',
    '使用仓库内的 {file} 配方。安装前请检查命令。',
    'Depodaki {file} tarifi kullanılıyor. Kurmadan önce komutları gözden geçirin.'
  ],
  'backend.noteDraft': [
    'No {file} found in the repository; a draft was inferred from its files. Adjust it using the README.',
    '仓库内没有 {file}，已根据文件推测生成草稿。请参照 README 调整。',
    'Depoda {file} yok; dosyalara bakılarak bir taslak hazırlandı. README’ye göre düzeltin.'
  ],
  'event.refused': ['The model did not answer this request.', '模型未回答此请求。', 'Model bu isteği yanıtlamadı.'],
  'event.claudeRefused': ['Claude did not answer this request.', 'Claude 未回答此请求。', 'Claude bu isteği yanıtlamadı.'],
  'event.length': ['The response reached its length limit; write “continue” to proceed.', '回复已达到长度上限，输入“继续”可接着处理。', 'Yanıt uzunluk sınırında kesildi; "devam" yazabilirsin.'],
  'event.briefLength': ['The response reached its length limit; write to continue.', '回复已达到长度上限，发送消息可继续。', 'Yanıt uzunluk sınırında kesildi; devam etmek için yazın.'],
  'event.rounds': ['Reached the round limit ({count}); write to continue.', '已达到轮次上限（{count}），发送消息可继续。', 'Tur sınırına ({count}) ulaşıldı; devam etmek için yaz.'],
  'event.kitUpdated': ['Production kit updated: {count} items', '生产套件已更新：{count} 项', 'Üretim kiti güncellendi: {count} kalem'],
  'event.briefReady': ['Brief ready — review the kit and send it to production.', '需求简报已就绪，请检查套件并提交生产。', 'Brief hazır — kiti gözden geçirip üretime gönderebilirsin.'],
  'event.error': ['Error: {detail}', '错误：{detail}', 'Hata: {detail}'],
  'anim.buildNoResponse': ['Unreal returned no result', 'Unreal 未返回结果', 'Unreal’dan sonuç gelmedi'],
  'anim.buildConnection': [
    'Could not connect to Unreal: {detail}. The script was saved; run it using File → Execute Python Script in Unreal: {file}',
    '无法连接 Unreal：{detail}。脚本已保存，请在 Unreal 中通过 File → Execute Python Script 运行：{file}',
    'Unreal’a bağlanılamadı: {detail}. Betik kaydedildi; Unreal’da File → Execute Python Script ile çalıştırabilirsin: {file}'
  ],
  'comfy.fitFailed': ['Could not check compatibility: {detail}', '无法检查兼容性：{detail}', 'Uygunluk denetlenemedi: {detail}'],
  'assistant.providerRemoved': ['{model} (provider deleted — start a new conversation)', '{model}（提供商已删除，请新建对话）', '{model} (sağlayıcı silinmiş — yeni sohbet aç)'],
  'backend.installed': ['{name} installed', '{name} 已安装', '{name} kuruldu'],
  'feedback.copied': ['Copied to clipboard', '已复制到剪贴板', 'Panoya kopyalandı'],
  'feedback.assetCount': ['{count} assets', '{count} 个资源', '{count} asset'],
  'feedback.namedDetail': ['{name}: {detail}', '{name}：{detail}', '{name}: {detail}'],
  'feedback.passed': ['PASSED', '通过', 'GEÇTİ'],
  'feedback.failed': ['FAILED', '未通过', 'KALDI'],
  'feedback.imageEdit': [' · editing from an image', ' · 基于图像编辑', ' · görselden düzenleme'],
  'feedback.present': ['present', '有', 'var'],
  'feedback.missing': ['missing', '无', 'YOK'],
  'feedback.loopSuffix': [', loop', '，循环', ', döngü'],
  'feedback.shellEnabled': [' · shell enabled', ' · 终端已启用', ' · terminal açık'],
  ...logRows,
  'log.retry': [
    '↻ Retry {attempt}/{max}: rewriting the prompt with feedback',
    '↻ 重试 {attempt}/{max}：根据反馈重新编写提示词',
    '↻ Yeniden deneme {attempt}/{max}: prompt geri bildirimle yeniden yazılacak'
  ],
  'provider.error': ['{provider}: {hint} ({status}) {detail}', '{provider}：{hint}（{status}）{detail}', '{provider}: {hint} ({status}) {detail}'],
  'provider.invalidRequest': ['Invalid request', '请求无效', 'Geçersiz istek'],
  'provider.invalidKey': ['API key is invalid or missing', 'API 密钥无效或缺失', 'API anahtarı geçersiz veya eksik'],
  'provider.noCredit': ['Insufficient credits, or API access unavailable on this plan', '积分不足，或当前套餐不支持 API', 'Kredi yetersiz veya plan API desteklemiyor'],
  'provider.forbidden': ['Permission denied', '没有权限', 'Bu işlem için yetki yok'],
  'provider.notFound': ['Task not found', '找不到任务', 'Görev bulunamadı'],
  'provider.rateLimit': ['Request limit exceeded', '超过请求频率限制', 'İstek sınırı aşıldı'],
  'provider.failed': ['Request failed', '请求失败', 'İstek başarısız'],
  'provider.unknownError': ['Unknown error', '未知错误', 'Bilinmeyen hata'],
  'provider.audioFormat': [
    'Your plan may not support this output format (Settings → audio format)',
    '当前套餐可能不支持此输出格式（设置 → 音频格式）',
    'Bu çıktı formatı planınızda yok olabilir (Ayarlar → ses formatı)'
  ],
  'blender.failed': ['Blender failed (code {code}). Last output:\n{detail}', 'Blender 失败（代码 {code}）。最后输出：\n{detail}', 'Blender hata ile bitti (kod {code}). Son çıktı:\n{detail}'],
  'blender.animFailed': [
    'Blender animation conversion failed (code {code}):\n{detail}',
    'Blender 动画转换失败（代码 {code}）：\n{detail}',
    'Blender animasyon dönüşümü başarısız (kod {code}):\n{detail}'
  ],
  'assistant.awaiting': ['Awaiting approval', '等待批准', 'onay bekliyor'],
  'assistant.denied': ['Denied', '已拒绝', 'reddedildi'],
  ...qaRows,
  ...errorRows,
  'web.hostOnly': [
    'This action is available only on the computer running AssetForge.',
    '此操作仅能在运行 AssetForge 的电脑上执行。',
    'Bu işlem yalnızca AssetForge’un çalıştığı bilgisayarda yapılabilir'
  ],
  'web.noSession': ['Session missing or expired; sign in again.', '会话不存在或已过期，请重新登录。', 'Oturum yok ya da süresi doldu; yeniden giriş yapın'],
  'web.invalidRequest': ['Invalid request', '无效请求', 'Geçersiz istek'],
  'web.editorUpload': ['Editor role is required to upload files', '上传文件需要编辑者权限', 'Dosya yüklemek için editör rolü gerekir'],
  'web.ownerOnly': ['Owner only', '仅限所有者', 'Yalnızca sahip'],
  'web.unknownAction': ['Unknown action: {channel}', '未知操作：{channel}', 'Bilinmeyen işlem: {channel}'],
  'web.notAllowed': [
    'You do not have permission for this action. Ask the project owner for access.',
    '你无权执行此操作，请向项目所有者申请权限。',
    'Bu işlem için yetkin yok. Proje sahibinden rol isteyebilirsin.'
  ],
  'web.foreignPath': ['Files outside the project folder cannot be used: {path}', '无法使用项目文件夹外的文件：{path}', 'Proje klasörü dışındaki dosyalar kullanılamaz: {path}'],
  'web.notFound': ['Not found', '未找到', 'Bulunamadı'],
  'connect.canceled': ['Canceled', '已取消', 'İptal edildi'],
  'connect.keyFormat': [
    'Copied text does not look like a {name} key (starts with “{hint}”). Copy the key itself, or select Try clipboard.',
    '复制的文本不像 {name} 密钥（以“{hint}”开头）。请复制密钥本身，或点击尝试剪贴板。',
    'Kopyalanan metin {name} anahtarına benzemiyor (“{hint}” ile başlar). Anahtarın kendisini kopyalayın; emin değilseniz “Panodakini dene”ye basın.'
  ],
  'connect.emptyClipboard': ['Clipboard is empty. Copy the key and retry.', '剪贴板为空。请复制密钥后重试。', 'Pano boş. Sayfadaki anahtarı kopyalayıp tekrar deneyin.'],
  'connect.rejectedBefore': [
    '{name} just rejected this key. Create and copy a new key.',
    '{name} 刚刚拒绝了此密钥。请创建并复制新密钥。',
    'Bu anahtarı {name} az önce reddetti. Yeni bir anahtar oluşturup onu kopyalayın.'
  ],
  'connect.checkingKey': ['Key detected, verifying…', '已检测到密钥，正在验证…', 'Anahtar yakalandı, doğrulanıyor…'],
  'connect.retryKey': ['{detail} — you can copy another key; still waiting.', '{detail}；可以复制其他密钥，仍在等待。', '{detail} — başka bir anahtar kopyalayabilirsiniz, beklemeye devam ediyorum.'],
  'connect.waitKey': [
    'Sign in in your browser, create a key and select Copy. AssetForge detects it automatically.',
    '请在浏览器中登录，创建密钥并点击复制。AssetForge 会自动识别。',
    'Tarayıcıda giriş yapın, yeni anahtar oluşturup Kopyala’ya basın — AssetForge otomatik yakalar.'
  ],
  'connect.timeoutKey': [
    'Timed out (10 min). Connect again or paste the key manually.',
    '已超时（10 分钟）。请重新连接或手动粘贴密钥。',
    'Süre doldu (10 dk). Tekrar “Bağlan”a basın ya da anahtarı elle yapıştırın.'
  ],
  'connect.oauthRejected': [
    'OpenRouter authorization failed (rejected or invalid response).',
    'OpenRouter 授权失败（被拒绝或响应无效）。',
    'OpenRouter onayı alınamadı (reddedildi ya da geçersiz yanıt).'
  ],
  'connect.creatingKey': ['Authorized, creating a key…', '已授权，正在创建密钥…', 'Onay alındı, anahtar oluşturuluyor…'],
  'connect.routerDone': ['OpenRouter connected — available in task assignments.', 'OpenRouter 已连接，可在任务分配中使用。', 'OpenRouter bağlandı — Görev atamalarından kullanabilirsiniz.'],
  'connect.waitRouter': [
    'Sign in to OpenRouter in your browser and select Authorize. The rest is automatic.',
    '请在浏览器中登录 OpenRouter 并点击 Authorize，其余步骤会自动完成。',
    'Tarayıcıda OpenRouter’a giriş yapıp “Authorize”a basın — gerisi otomatik.'
  ],
  'connect.timeout': ['Timed out (10 min). Please retry.', '已超时（10 分钟），请重试。', 'Süre doldu (10 dk). Tekrar deneyin.'],
  'connect.connected': ['{name} connected{detail}', '{name} 已连接{detail}', '{name} bağlandı{detail}'],
  'connect.meshyBalance': ['Meshy connected · {balance} credits', 'Meshy 已连接 · {balance} 积分', 'Meshy bağlandı · {balance} kredi'],
  'connect.limitedKey': ['ElevenLabs connected (restricted key)', 'ElevenLabs 已连接（受限密钥）', 'ElevenLabs bağlandı (kısıtlı anahtar)'],
  'connect.notApproved': ['Connection not authorized', '连接未获授权', 'Bağlantı onaylanmadı'],
  'connect.closeRetry': ['Close this tab and retry in AssetForge.', '请关闭此标签页，在 AssetForge 中重试。', 'Bu pencereyi kapatıp AssetForge’da tekrar deneyebilirsiniz.'],
  'connect.appConnected': ['AssetForge connected', 'AssetForge 已连接', 'AssetForge bağlandı'],
  'connect.closeDone': [
    'Your OpenRouter account is connected. Close this tab and return to the app.',
    'OpenRouter 账号已连接。请关闭此标签页并返回应用。',
    'OpenRouter hesabınız bağlandı. Bu sekmeyi kapatıp uygulamaya dönebilirsiniz.'
  ],
  'connect.problem': ['Something went wrong', '出现问题', 'Bir sorun oldu'],
  'connect.noKey': ['OpenRouter returned no key', 'OpenRouter 未返回密钥', 'OpenRouter anahtar döndürmedi'],
  'connect.keyRejected': ['Key rejected', '密钥被拒绝', 'Anahtar reddedildi'],
  'connect.response': ['{name} response: {status} {detail}', '{name} 响应：{status} {detail}', '{name} yanıtı {status} {detail}'],
  'viewer.bvhFailed': ['Could not load BVH ({status})', '无法加载 BVH（{status}）', 'BVH okunamadı ({status})']
} as const

function column<I extends 0 | 1 | 2>(index: I) {
  return Object.fromEntries(Object.entries(feedbackRows).map(([key, row]) => [key, row[index]])) as { [K in keyof typeof feedbackRows]: (typeof feedbackRows)[K][I] }
}
export const feedbackEn = column(0)
export const feedbackZh = column(1)
export const feedbackTr = column(2)
