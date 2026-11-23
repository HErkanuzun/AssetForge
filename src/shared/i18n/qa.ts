// SPDX-License-Identifier: AGPL-3.0-only
// Report descriptors accompany legacy text; prompt corrections and scores are unchanged.
export const qaRows = {
  'qa.audioMetrics': [
    '{name}: {seconds} s · peak {peak} dBFS · average {rms} dBFS · clipping {clipped}% · leading/trailing silence {lead}/{trail} s',
    '{name}：{seconds} 秒 · 峰值 {peak} dBFS · 平均 {rms} dBFS · 削波 {clipped}% · 首尾静音 {lead}/{trail} 秒',
    '{name}: {seconds} sn · tepe {peak} dBFS · ortalama {rms} dBFS · kırpılma %{clipped} · baş/son sessizlik {lead}/{trail} sn'
  ],
  'qa.audioSeam': ['Loop seam: {jump}, {level} dB', '循环接缝：{jump}，{level} dB', 'Döngü dikişi: {jump}, {level} dB'],
  'qa.skippedAudio': [
    '{count} non-WAV files were not measured. Select PCM in Settings → Project to inspect all files.',
    '{count} 个非 WAV 文件未测量。在设置 → 项目中选择 PCM 格式可检查所有文件。',
    '{count} dosya WAV değil; ölçülmedi. Ayarlar → Proje’den PCM biçimini seçin.'
  ],
  'qa.motionDuration': ['Duration: {seconds} s, {frames} frames @ {fps} fps', '时长：{seconds} 秒，{frames} 帧 @ {fps} fps', 'Süre: {seconds} sn, {frames} kare @ {fps} fps'],
  'qa.skateMeasure': [
    'Foot sliding: {speed} m/s ({ratio}% of grounded frames; warning {warn}, failure {fail})',
    '脚滑：{speed} 米/秒（触地帧中 {ratio}% 滑动；警告 {warn}，失败 {fail}）',
    "Ayak kayması: {speed} m/sn (yerdeki karelerin %{ratio}'i kayıyor; uyarı {warn}, hata {fail})"
  ],
  'qa.penetrationMeasure': [
    'Ground penetration: {value} cm (warning {warn}, failure {fail})',
    '穿地：{value} 厘米（警告 {warn}，失败 {fail}）',
    'Zemine girme: {value} cm (uyarı {warn}, hata {fail})'
  ],
  'qa.jitterMeasure': [
    'Jitter: {value} m/s³ (warning {warn}, failure {fail}) · discontinuity {pop} cm',
    '抖动：{value} 米/秒³（警告 {warn}，失败 {fail}）· 不连续跳变 {pop} 厘米',
    'Titreme: {value} m/sn³ (uyarı {warn}, hata {fail}) · kopukluk {pop} cm'
  ],
  'qa.contactMeasure': ['Foot contact: {ratio}% of frames', '足部触地：{ratio}% 的帧', "Ayak yerde: karelerin %{ratio}'i"],
  'qa.speedMeasure': ['Speed: target {want} m/s, measured {got} m/s', '速度：目标 {want} 米/秒，实测 {got} 米/秒', 'Hız: hedef {want} m/sn, ölçülen {got} m/sn'],
  'qa.directionMeasure': ['Direction: target {want}°, measured {got}°', '方向：目标 {want}°，实测 {got}°', 'Yön: hedef {want}°, ölçülen {got}°'],
  'qa.turnMeasure': ['Turn: target {want}°, measured {got}°', '转向：目标 {want}°，实测 {got}°', 'Dönüş: hedef {want}°, ölçülen {got}°'],
  'qa.seamMeasure': ['Loop seam: {value}', '循环接缝：{value}', 'Döngü dikişi: {value}'],
  'qa.motionSkate': ['Feet slide noticeably while grounded ({value} m/s)', '脚部触地时明显滑动（{value} 米/秒）', 'Ayaklar yerdeyken belirgin kayıyor ({value} m/sn)'],
  'qa.motionSkateMild': ['Mild foot sliding ({value} m/s)', '轻微脚滑（{value} 米/秒）', 'Hafif ayak kayması ({value} m/sn)'],
  'qa.penetration': ['Feet penetrate the ground by {value} cm', '脚部穿入地面 {value} 厘米', 'Ayak zeminin {value} cm altına iniyor'],
  'qa.penetrationMild': ['Slight ground penetration ({value} cm)', '轻微穿地（{value} 厘米）', 'Ayak zemine biraz giriyor ({value} cm)'],
  'qa.pop': ['Sudden {value} cm jump in one frame (discontinuity)', '单帧突跳 {value} 厘米（动作不连续）', 'Bir karede {value} cm ani sıçrama var (kopuk geçiş)'],
  'qa.jitter': ['Motion jitter ({value} m/s³)', '动作抖动（{value} 米/秒³）', 'Hareket titrek ({value} m/sn³)'],
  'qa.jitterMild': ['Mild jitter ({value} m/s³)', '轻微抖动（{value} 米/秒³）', 'Hafif titreme ({value} m/sn³)'],
  'qa.stationary': ['Feet lift too much for stationary motion', '原地动作的脚部抬起幅度过大', 'Yerinde durması gereken hareket ayaklarını çok kaldırıyor'],
  'qa.speed': ['Speed differs from target ({got} m/s, target {want})', '速度偏离目标（实测 {got} 米/秒，目标 {want}）', 'Hız hedeften uzak ({got} m/sn, hedef {want})'],
  'qa.direction': ['Movement direction deviates by {value}°', '移动方向偏差 {value}°', 'Hareket yönü {value}° sapıyor'],
  'qa.turn': ['Turn angle differs from target by {value}°', '转向角度与目标相差 {value}°', 'Dönüş açısı hedeften {value}° farklı'],
  'qa.loop': ['Loop endpoints differ; a small seam jump may occur', '循环首尾不一致，接缝处可能出现轻微跳变', 'Döngü başı ve sonu arasında fark var; dikişte küçük atlama olabilir'],
  'qa.motionPassed': ['Motion passed technical checks', '动作已通过技术检查', 'Hareket teknik kontrolleri geçti'],
  'qa.audioPassed': ['Audio passed technical checks', '音频已通过技术检查', 'Ses teknik kontrolleri geçti'],
  'qa.noWav': ['No measurable WAV files', '没有可测量的 WAV 文件', 'Ölçülebilir WAV dosyası yok'],
  'qa.silent': ['{name}: file is almost completely silent', '{name}：文件几乎完全静音', '{name}: dosya neredeyse tamamen sessiz'],
  'qa.clipping': [
    '{name}: clipping/distortion ({value}% of samples at full scale)',
    '{name}：存在削波或失真（{value}% 的采样达到满幅）',
    "{name}: kırpılma / distorsiyon var (örneklerin %{value}'i tam ölçekte)"
  ],
  'qa.clippingMild': ['{name}: mild clipping', '{name}：轻微削波', '{name}: hafif kırpılma'],
  'qa.quiet': ['{name}: too quiet (average {value} dBFS)', '{name}：音量过低（平均 {value} dBFS）', '{name}: çok kısık (ortalama {value} dBFS)'],
  'qa.leadingSilence': ['{name}: starts with {value} s of silence', '{name}：开头有 {value} 秒静音', '{name}: başında {value} sn sessizlik var'],
  'qa.duration': ['{name}: duration {got} s, requested {want} s', '{name}：时长 {got} 秒，要求 {want} 秒', '{name}: süre {got} sn, istenen {want} sn'],
  'qa.seamClick': ['{name}: possible click at loop seam', '{name}：循环接缝处可能有咔哒声', '{name}: döngü dikişinde tık sesi olabilir'],
  'qa.seamLevel': ['{name}: possible level jump at loop seam ({value} dB)', '{name}：循环接缝处可能有音量跳变（{value} dB）', '{name}: döngü dikişinde seviye sıçraması ({value} dB) olabilir'],
  'qa.loopGap': ['{name}: silence at loop start/end', '{name}：循环音频首尾存在空白', '{name}: döngü sesinde baş/son boşluğu var']
} as const
