// SPDX-License-Identifier: AGPL-3.0-only
export const logRows = {
  'log.db4c7ab78b': ['MCP connection failed — {p0}', 'MCP 连接失败：{p0}', '⚠ MCP bağlanamadı — {p0}'],
  'log.d0ef5f4634': ['{p0} ({p1}) · {p2} tools', '{p0}（{p1}）· {p2} 个工具', '{p0} ({p1}) · {p2} araç'],
  'log.f699cfe4da': ['Reached round limit ({p0})', '已达到轮次上限（{p0}）', 'Tur sınırına ({p0}) ulaşıldı'],
  'log.7d1bc247d3': ['Claude Code · MCP: {p0}{p1}', 'Claude Code · MCP：{p0}{p1}', 'Claude Code · MCP: {p0}{p1}'],
  'log.a19f9759d3': ['Codex · MCP: {p0}', 'Codex · MCP：{p0}', 'Codex · MCP: {p0}'],
  'log.4f3d48837c': ['Meshy {p0} task: {p1}', 'Meshy {p0} 任务：{p1}', 'Meshy {p0} görevi: {p1}'],
  'log.9abf90b0dc': ['BVH: {p0} frames, {p1} s', 'BVH：{p0} 帧，{p1} 秒', 'BVH: {p0} kare, {p1} sn'],
  'log.4c356a9a93': ['Workflow: {p0}', '工作流：{p0}', 'Workflow: {p0}'],
  'log.615a273e8b': ['Score {p0}/10 → {p1}: {p2}', '评分 {p0}/10 → {p1}：{p2}', 'Puan {p0}/10 → {p1}: {p2}'],
  'log.d03b6efc08': [
    'Animation has no BVH file (FBX only); motion measurement skipped',
    '动画没有 BVH 文件（仅有 FBX），已跳过运动测量',
    'Animasyonun BVH dosyası yok (yalnızca FBX); hareket ölçülemedi, kontrol atlandı'
  ],
  'log.f9ee5ca3d3': ['Local model: {p0}', '本地模型：{p0}', 'Yerel model: {p0}'],
  'log.d45225d7b8': ['Local image: {p0}', '本地图像：{p0}', 'Yerel görsel: {p0}'],
  'log.3a60a7883a': ['Prompt ({p0} characters): {p1}', '提示词（{p0} 个字符）：{p1}', 'Prompt ({p0} kr): {p1}'],
  'log.26adb1caff': ['Texture prompt: {p0}', '纹理提示词：{p0}', 'Doku promptu: {p0}'],
  'log.65ab307830': ['Negative: {p0}', '负向提示词：{p0}', 'Negatif: {p0}'],
  'log.7fb6f89580': ['Reasoning: {p0}', '说明：{p0}', 'Gerekçe: {p0}'],
  'log.d3ba8ac054': ['Unrecognized outputs skipped: {p0}', '已跳过无法识别的输出：{p0}', 'Tanınmayan çıktılar atlandı: {p0}'],
  'log.04eb6305ec': ['Outputs: {p0}', '输出：{p0}', 'Çıktılar: {p0}'],
  'log.4ca65d63ea': ['{p0} · {p1}{p2}', '{p0} · {p1}{p2}', '{p0} · {p1}{p2}'],
  'log.f2afa67cb6': ['Identity provider not found ({p0}); sending without a key', '找不到身份提供商（{p0}），将不携带密钥发送', 'Kimlik sağlayıcısı bulunamadı ({p0}); anahtarsız gönderiliyor'],
  'log.0a5191eaed': ['Downloaded: {p0}', '已下载：{p0}', 'İndirildi: {p0}'],
  'log.60daf7b71f': ['Agent: {p0}', '智能体：{p0}', 'Ajan: {p0}'],
  'log.f26b23d27b': ['Cost: ${p0}', '费用：${p0}', 'Maliyet: ${p0}'],
  'log.8361bc1e8e': ['Generated files: {p0}', '已生成文件：{p0}', 'Üretilen dosyalar: {p0}'],
  'log.6e0556f0f7': ['Assembly: {p0}', '装配：{p0}', 'Montaj: {p0}'],
  'log.3d8b062509': [
    'Assembly: {p0} parts ({p1}), {p2} sockets, {p3} damage zones, {p4} clips',
    '装配：{p0} 个部件（{p1}）、{p2} 个插槽、{p3} 个损伤区域、{p4} 个片段',
    'Montaj: {p0} parça ({p1}), {p2} soket, {p3} ezilme bölgesi, {p4} klip'
  ],
  'log.051e101d90': ['Model faces {p0}; extracting views again', '模型正面朝向 {p0}，正在重新提取视图', 'Modelin önü {p0} yönünde; görünüşler yeniden çıkarılıyor'],
  'log.ed7adae3ce': ['Plan: {p0}', '方案：{p0}', 'Plan: {p0}'],
  'log.6801f41562': ['Review {p0}: approved', '第 {p0} 次检查：已通过', 'Kontrol {p0}: onaylandı'],
  'log.bae8644926': ['Review {p0}: {p1}', '第 {p0} 次检查：{p1}', 'Kontrol {p0}: {p1}'],
  'log.e38c0c0682': ['Rig complete; animations: {p0}', '绑定完成，动画：{p0}', 'Rig tamam; animasyonlar: {p0}'],
  'log.fd3795af66': ['Triangles {p0} (original {p1}) · dimensions {p2} m · UV {p3}', '三角面 {p0}（原始 {p1}）· 尺寸 {p2} 米 · UV {p3}', 'Üçgen {p0} (orijinal {p1}) · ölçü {p2} m · UV {p3}'],
  'log.5aec1e5749': ['Score {p0}/10 (threshold {p1}) → {p2}: {p3}', '评分 {p0}/10（阈值 {p1}）→ {p2}：{p3}', 'Puan {p0}/10 (eşik {p1}) → {p2}: {p3}'],
  'log.4cd6dad11c': ['Audio {p0}/{p1}: {p2}', '音频 {p0}/{p1}：{p2}', 'Ses {p0}/{p1}: {p2}'],
  'log.109df901eb': ['Layer {p0}/{p1}: {p2} rpm → {p3}', '音层 {p0}/{p1}：{p2} rpm → {p3}', 'Katman {p0}/{p1}: {p2} rpm → {p3}'],
  'log.2749d46ea9': ['QA correction added to prompt: {p0}', '已将质量检查修正加入提示词：{p0}', 'Kalite kontrol düzeltmesi prompta eklendi: {p0}'],
  'log.a1394efbd7': ['Motion prompt: {p0} ({p1} s) — {p2}', '动作提示词：{p0}（{p1} 秒）— {p2}', 'Hareket promptu: {p0} ({p1} sn) — {p2}'],
  'log.58fdf5fcba': ['Could not read KimodoSpec; generating without constraints', '无法读取 KimodoSpec，将不使用约束生成', 'KimodoSpec okunamadı; düz üretim yapılıyor'],
  'log.3c8a0f16b6': ['Retry: seed {p0} → {p1}', '重试：种子 {p0} → {p1}', 'Yeniden deneme: seed {p0} → {p1}'],
  'log.1f7c682807': ['Start pose source has not been generated; pose matching skipped', '起始姿势来源尚未生成，已跳过姿势匹配', 'Başlangıç pozu kaynağı henüz üretilmemiş; poz eşleme atlandı'],
  'log.713d781184': ['End pose source has not been generated; pose matching skipped', '结束姿势来源尚未生成，已跳过姿势匹配', 'Bitiş pozu kaynağı henüz üretilmemiş; poz eşleme atlandı'],
  'log.c847a02057': [
    'System clip ({p0}{p1}): target {p2}{p3} m/s, direction {p4}°, turn {p5}° · constraints: {p6}',
    '系统片段（{p0}{p1}）：目标 {p2}{p3} 米/秒，方向 {p4}°，转向 {p5}° · 约束：{p6}',
    'Sistem klibi ({p0}{p1}): hedef {p2}{p3} m/sn, yön {p4}°, dönüş {p5}° · kısıtlar: {p6}'
  ],
  'log.4c92e67ef2': ['Kimodo: generating {p0} segments, {p1} s', 'Kimodo：生成 {p0} 段，共 {p1} 秒', 'Kimodo: {p0} segment, {p1} sn üretim'],
  'log.583ada8c5b': ['Constrained generation failed ({p0}); retrying without constraints', '约束生成失败（{p0}），将去除约束重试', 'Kısıtlı üretim başarısız ({p0}); kısıtsız tekrar deneniyor'],
  'log.50aa684b54': ['Kimodo generated {p0} frames @ {p1} fps (took {p2} s)', 'Kimodo 已生成 {p0} 帧，{p1} fps（耗时 {p2} 秒）', 'Kimodo üretti: {p0} kare @ {p1} fps ({p2} sn sürdü)'],
  'log.6610ffb475': ['FBX animation: {p0} frames, {p1} s', 'FBX 动画：{p0} 帧，{p1} 秒', 'FBX animasyon: {p0} kare, {p1} sn'],
  'log.dde0d0d25e': ['Export folder: {p0}', '导出文件夹：{p0}', 'Export klasörü: {p0}'],
  'log.935d0aa769': [
    'Assembled models require automatic import (Unreal Editor must be open)',
    '装配模型需要自动导入（须打开 Unreal Editor）',
    'Montajlı model yalnızca otomatik import ile kurulabilir (açık Unreal Editor gerekir)'
  ],
  'log.8821ec347f': ['Unreal setup could not complete: {p0}', 'Unreal 设置未能完成：{p0}', 'Unreal kurulumu tamamlanamadı: {p0}'],
  'log.1177a13668': [
    'Dynamic audio: {p0} layers → MS_{p1} (inputs: RPM, Throttle)',
    '动态音频：{p0} 个音层 → MS_{p1}（输入：RPM、Throttle）',
    'Dinamik ses: {p0} katman → MS_{p1} (girişler: RPM, Throttle)'
  ],
  'log.7b2ae02785': ['Unreal import error: {p0}', 'Unreal 导入错误：{p0}', 'Unreal import hatası: {p0}'],
  'log.4654ce290d': ['Imported into Unreal → {p0}', '已导入 Unreal → {p0}', "Unreal'a import edildi → {p0}"],
  'log.c1a4bf34f4': [
    'Automatic Unreal import failed ({p0}). Manually: Unreal → File → Execute Python Script → {p1}',
    'Unreal 自动导入失败（{p0}）。手动操作：Unreal → File → Execute Python Script → {p1}',
    "Unreal'a otomatik import yapılamadı ({p0}). Elle: Unreal → File → Execute Python Script → {p1}"
  ],
  'log.7bb5f52c83': ['QA did not pass, but the pipeline will continue ({p0})', '质量检查未通过，但流水线将继续（{p0}）', 'Kalite kontrol geçilemedi ama hat devam ediyor ({p0})'],
  'log.54c4c06f7b': ['Waiting for kit audio: {p0}', '正在等待套件音频：{p0}', 'Kit sesleri bekleniyor: {p0}'],
  'log.cc080e980d': [
    'Unfinished kit audio skipped: {p0} (run Export again after completion)',
    '已跳过未完成的套件音频：{p0}（完成后请重新导出）',
    "Bitmemiş kit sesleri atlandı: {p0} (bitince Export'u yeniden çalıştırın)"
  ],
  'log.bbf2b1e2a7': ['Kit audio has no output: {p0}', '套件音频没有输出：{p0}', 'Çıktısı olmayan kit sesleri: {p0}'],
  'log.e44def4ebc': ['Could not create engine MetaSound: {p0}', '无法创建引擎 MetaSound：{p0}', "Motor MetaSound'u kurulamadı: {p0}"],
  'log.cf4a922056': [
    'Unreal: importing skeletal mesh, damage targets, clips and audio',
    'Unreal：正在导入骨骼网格、损伤目标、片段和音频',
    'Unreal: iskeletli mesh, ezilme hedefleri, klipler ve sesler içe aktarılıyor'
  ],
  'log.6b273cda59': [
    'Unreal has no CreateVehiclePhysicsAsset tool; create the physics asset and Anim BP manually',
    'Unreal 没有 CreateVehiclePhysicsAsset 工具，请手动创建物理资源和 Anim BP',
    'Unreal’da CreateVehiclePhysicsAsset aracı yok: fizik asset’i ve Anim BP elle kurulmalı'
  ],
  'log.2fa13d1db7': ['Could not create physics / Anim BP: {p0}', '无法创建物理资源 / Anim BP：{p0}', 'Fizik / Anim BP kurulamadı: {p0}'],
  'log.c49393a6fd': [
    'Vehicle template not found ({p0}). Mesh, physics and Anim BP are ready; enter an AWheeledVehiclePawn Blueprint in Export → Vehicle template.',
    '找不到车辆模板（{p0}）。网格、物理资源和 Anim BP 已就绪；请在导出 → 车辆模板中填写 AWheeledVehiclePawn 蓝图。',
    'Araç şablonu bulunamadı ({p0}). Mesh, fizik ve Anim BP hazır; Blueprint için Export → “Araç şablonu” alanına bir AWheeledVehiclePawn Blueprint’i yazın.'
  ],
  'log.e58bd85677': ['Unreal: creating vehicle Blueprint from template {p0}', 'Unreal：正在从模板 {p0} 创建车辆蓝图', 'Unreal: {p0} şablonundan araç Blueprint’i kuruluyor'],
  'log.047ba4fe9d': ['Creating Python {p0} virtual environment…', '正在创建 Python {p0} 虚拟环境…', 'Python {p0} sanal ortamı oluşturuluyor…'],
  'log.b59c68d258': ['Installation complete', '安装完成', 'Kurulum tamam'],
  'log.0704e2f445': ['Starting: {p0}', '正在启动：{p0}', 'Başlatılıyor: {p0}'],
  'log.f267cf8e77': [
    'Starting “{p0}” (models may download on first launch; timeout {p1} min)…',
    '正在启动“{p0}”（首次启动可能下载模型，最长等待 {p1} 分钟）…',
    '“{p0}” açılıyor (ilk açılışta modeller indirilebilir; en fazla {p1} dk beklenir)…'
  ],
  'log.7c7aceb0bf': ['“{p0}” is ready: {p1}', '“{p0}”已就绪：{p1}', '“{p0}” hazır: {p1}'],
  'log.f2bf8236aa': ['{p0} is ready', '{p0} 已就绪', '{p0} hazır'],
  'log.6be301d737': ['ComfyUI is stopped; starting…', 'ComfyUI 未运行，正在启动…', 'ComfyUI kapalı; başlatılıyor…'],
  'log.6fcef4feaa': ['ComfyUI: skipped {p0} ({p1})', 'ComfyUI：已跳过 {p0}（{p1}）', 'ComfyUI: {p0} atlandı ({p1})'],
  'log.dd6c704e59': ['ComfyUI server: {p0} ({p1})', 'ComfyUI 服务器：{p0}（{p1}）', 'ComfyUI sunucusu: {p0} ({p1})'],
  'log.1e5b189a48': [
    'Enabling Virtual Machine Platform (administrator approval required)…',
    '正在启用虚拟机平台（需要管理员批准）…',
    'Sanal Makine Platformu etkinleştiriliyor (yönetici onayı istenecek)…'
  ],
  'log.549d37d9f4': ['Installing {p0}…', '正在安装 {p0}…', '{p0} kuruluyor…'],
  'log.986c30103a': ['Uploaded to ComfyUI: {p0}', '已上传至 ComfyUI：{p0}', "ComfyUI'a yüklendi: {p0}"],
  'log.4ca2035f83': ['ComfyUI job: {p0}', 'ComfyUI 任务：{p0}', 'ComfyUI işi: {p0}'],
  'log.459b8eec25': ['Gradio: {p0} · endpoint {p1}', 'Gradio：{p0} · 端点 {p1}', 'Gradio: {p0} · uç nokta {p1}'],
  'log.69e919a63f': ['Gradio text output: {p0}', 'Gradio 文本输出：{p0}', 'Gradio metin çıktısı: {p0}'],
  'log.cf5bb68c3d': ['Unrecognized output skipped: {p0}', '已跳过无法识别的输出：{p0}', 'Tanınmayan çıktı atlandı: {p0}'],
  'log.7db3d197e7': ['Job ID: {p0}', '任务 ID：{p0}', 'İş kimliği: {p0}']
} as const
