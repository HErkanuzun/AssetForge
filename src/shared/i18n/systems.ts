// SPDX-License-Identifier: AGPL-3.0-only
export const systemRows = {
  'system.single.title': ['Single clip', '单个片段', 'Tek Klip'],
  'system.single.short': [
    'A standalone animation: an idle loop or a one-shot gesture such as waving.',
    '独立播放的动画：待机循环，或挥手等一次性动作。',
    'Tek başına oynayan düz animasyon: döngü (bekleme) veya tek seferlik (selam, el sallama).'
  ],
  'system.single.what': [
    'The basic animation asset stores each skeletal frame over time. Marking it as a loop restarts playback at the beginning.',
    '最基础的动画资源，保存一段时间内的逐帧骨骼姿势。标为循环后会从头重复播放。',
    'En temel animasyon varlığı. Belirli bir süre boyunca iskeletin her karesini tutar. Döngü (loop) olarak işaretlenirse başa sarar.'
  ],
  'system.single.when': [
    'Cutscenes, NPC behavior and standalone movements. All other systems are built from these clips.',
    '过场动画、NPC 行为和独立动作。其他所有系统都由这些片段构成。',
    'Ara sahneler, NPC davranışları, tek başına oynayan hareketler. Diğer tüm sistemler aslında bu kliplerden yapılır.'
  ],
  'system.single.pro': [
    'Capture motion, clean foot sliding and noise in MotionBuilder/Maya, match loop endpoints and import FBX into Unreal.',
    '采集动作，在 MotionBuilder/Maya 中清理脚滑和噪声，对齐循环首尾帧，再以 FBX 导入 Unreal。',
    'Mocap stüdyosunda çekilir, MotionBuilder/Maya’da temizlenir (ayak kayması, gürültü), döngüyse ilk/son kare eşitlenir, Unreal’a FBX olarak girer.'
  ],
  'system.single.auto': [
    'Kimodo generates motion from text, trims and closes a clean loop when needed, adjusts root motion and retargets to your character.',
    'Kimodo 根据文字生成动作，按需裁剪并闭合干净的循环，调整根运动并重定向到角色。',
    'Kimodo metinden üretir; döngüyse en temiz döngü penceresini otomatik kesip dikişi kapatır, root motion ayarlar, karakterine retarget eder.'
  ],
  'system.single.limits': [
    'Kimodo may struggle with specialized or rare movements such as sports and acrobatics.',
    'Kimodo 对体育、杂技等特殊或少见动作的生成能力有限。',
    'Çok özel veya nadir hareketlerde (spor, akrobasi) Kimodo zayıf kalabilir.'
  ],
  'system.montage.title': ['Action montage', '动作蒙太奇', 'Aksiyon Montajı'],
  'system.montage.short': [
    'One-shot actions triggered by code or Blueprints: opening doors, picking up items, taking hits or attacking.',
    '由代码或蓝图触发的一次性动作：开门、拾取物品、受击或攻击。',
    'Kod/Blueprint ile tetiklenen tek seferlik aksiyonlar: kapı açma, eşya alma, darbe alma, saldırı.'
  ],
  'system.montage.what': [
    'A montage plays sequences through slots, with sections, notifies and root motion. It can be layered over locomotion.',
    '蒙太奇通过插槽播放序列，包含分段、通知和根运动，也可叠加在移动动画上。',
    'Montage, bir veya birkaç sekansı “slot” üzerinden oynatır; bölümler (section), notify’lar (ör. hasar anı) ve root motion taşır. Lokomosyonun üstüne katmanlanabilir.'
  ],
  'system.montage.when': [
    'Interactions, attacks, reloads and hit reactions that return to locomotion after the action.',
    '交互、攻击、换弹、受击等结束后恢复移动的动作。',
    'Etkileşimler, saldırılar, şarjör değiştirme, hasar tepkileri — oyuncu aksiyonu bittiğinde lokomosyona geri dönülen her şey.'
  ],
  'system.montage.pro': [
    'Actions start and end in a shared idle pose for seamless blending. Damage and sound timings use notifies.',
    '各动作从同一待机姿势开始并返回该姿势，以实现平滑混合。伤害和声音时机通过通知标记。',
    'Her aksiyon ortak bir “bekleme pozundan” başlayıp ona döner; böylece blend in/out görünmez olur. Hasar/ses anları notify ile işaretlenir.'
  ],
  'system.montage.auto': [
    'Generate idle first, match action endpoints to it, then create an AM_ montage for each action in Unreal.',
    '先生成待机，再将各动作首尾姿势与待机匹配，最后在 Unreal 中为每个动作创建 AM_ 蒙太奇。',
    'Önce bekleme klibini üretir, sonra her aksiyonun ilk ve son karesini o bekleme pozuna kilitler (poz eşleme). Unreal’da her biri için AM_ montajı kurar.'
  ],
  'system.montage.limits': [
    'Hand IK alignment for held items and notify timings need manual adjustment.',
    '持物手部的 IK 对齐和通知时机需要手动微调。',
    'Silah/eşya tutan eller için IK hizalaması ve notify zamanları elle ince ayar ister.'
  ],
  'system.blendspace1d.title': ['Speed Blend Space (1D)', '速度混合空间（1D）', 'Hız Blend Space (1D)'],
  'system.blendspace1d.short': [
    'Blend smoothly between idle, walking and running along one speed axis.',
    '沿单一速度轴平滑混合待机、行走和奔跑。',
    'Tek eksen (hız) üzerinde bekleme → yürüme → koşma arasında yumuşak geçiş.'
  ],
  'system.blendspace1d.what': [
    'Place rhythmic loops along one axis and blend adjacent clips by character speed, with optional playback rate scaling.',
    '沿一个轴放置节奏一致的循环，根据角色速度混合相邻片段，也可调整播放速率。',
    'Aynı ritimdeki döngüleri bir eksen üzerine yerleştirir; karakterin hızına göre iki komşu klibi ağırlıklı karıştırır. Hız kadar yavaşlatma/hızlandırma (rate scale) da yapabilir.'
  ],
  'system.blendspace1d.when': [
    'Simple locomotion for NPCs, follow-camera games and rapid prototypes.',
    '适用于 NPC、跟随视角游戏和快速原型的简单移动系统。',
    'Basit lokomosyon: NPC’ler, kamera hep arkada olan oyunlar, hızlı prototip.'
  ],
  'system.blendspace1d.pro': [
    'Loops start on the same foot and share left/right foot sync markers. Place samples at measured speeds to avoid foot sliding.',
    '循环从同一只脚开始，共用左右脚同步标记，并按实测速度放置样本以减少脚滑。',
    'Tüm döngüler aynı ayakla başlar ve “sync marker” (L/R ayak basışı) taşır; böylece karışırken ayaklar çakışmaz. Örnekler eksene gerçek hızlarında konur, yoksa ayak kayar.'
  ],
  'system.blendspace1d.auto': [
    'Constrain root paths to target speed, trim at left-foot contact, add sync markers and place samples at measured speed in cm/s.',
    '将根路径约束到目标速度，按左脚触地裁剪，添加同步标记，并按实测速度（厘米/秒）放置样本。',
    'Döngüleri hedef hızda kök yolu kısıtıyla üretir, sol ayak basışından kesip L/R sync marker’larını Kimodo ayak temaslarından otomatik ekler, örnekleri ölçülen gerçek hıza (cm/sn) yerleştirir.'
  ],
  'system.blendspace1d.limits': [
    'No directional changes; capsule rotation handles turns and may cause sliding. Use 2D or Motion Matching for more control.',
    '不支持方向变化；转向依赖胶囊体旋转，可能产生脚滑。更高要求可使用 2D 或运动匹配。',
    'Yön değişimi yok; dönüşler kapsülün dönmesiyle olur (ayak kayabilir). Daha iyisi için 2D veya Motion Matching.'
  ],
  'system.blendspace2d.title': ['Direction × Speed Blend Space (2D)', '方向 × 速度混合空间（2D）', 'Yön × Hız Blend Space (2D)'],
  'system.blendspace2d.short': [
    'Blend forward, backward and strafing motion on direction (-180…180) and speed axes.',
    '沿方向（-180…180）和速度轴混合前进、后退及侧移动作。',
    'Yön (-180…180) ve hız eksenleri: ileri, geri, yanlara (strafe) yürüme/koşma karışımı.'
  ],
  'system.blendspace2d.what': [
    'Arrange clips on a 2D grid and blend by speed and movement direction relative to facing. Standard for moving while aiming.',
    '将片段放在二维网格，按速度和相对朝向的运动方向混合，常用于瞄准时移动。',
    'Klipleri iki boyutlu bir ızgaraya yerleştirir; hem hıza hem de bakışa göre hareket yönüne göre karıştırır. Nişan alırken yanlama (strafe) için standarttır.'
  ],
  'system.blendspace2d.when': [
    'TPS/FPS characters, aiming locomotion and enemies that move without turning toward every direction.',
    '第三或第一人称角色、瞄准移动，以及无需转身即可多向移动的敌人。',
    'TPS/FPS karakterler, nişan alırken hareket, her yöne dönmeden yürüyen düşmanlar.'
  ],
  'system.blendspace2d.pro': [
    'Capture each direction and speed (usually 8 directions × 2–3 speeds); duplicate backward motion at ±180 and synchronize all clips.',
    '分别采集各方向和速度（通常为 8 个方向 × 2–3 档速度），将后退同时放在 ±180，并同步所有片段。',
    'Her yön ve hız için ayrı döngü çekilir (genelde 8 yön × 2-3 hız); geri yön ızgarada hem -180 hem 180’e konur. Hepsi sync marker ile senkronlanır.'
  ],
  'system.blendspace2d.auto': [
    'Generate 4 directions × 2 speeds plus idle, constrain paths, use measured values, duplicate 180 at -180 and add sync markers.',
    '生成 4 个方向 × 2 档速度及待机，约束根路径，采用实测值，将 180 复制到 -180，并添加同步标记。',
    '4 yön × 2 hız + bekleme üretir; her klibi istenen yön ve hızda kök yolu ile kilitler, ölçülen gerçek değerlere yerleştirir, 180 klibini -180’e de kopyalar, sync marker ekler.'
  ],
  'system.blendspace2d.limits': [
    'Diagonal motion blends adjacent clips. For precise games, extend the card to 8 directions.',
    '斜向动作由相邻片段混合得到。精度要求高的游戏建议扩展到 8 个方向。',
    'Çapraz yönler (45°) iki komşu klibin karışımıyla oluşur; çok hassas oyunlarda 8 yön önerilir (kartı genişletebilirsin).'
  ],
  'system.statemachine.title': ['Jump state machine', '跳跃状态机', 'Zıplama Durum Makinesi'],
  'system.statemachine.short': [
    'Jump start → airborne loop → landing → idle, with state transitions.',
    '起跳 → 空中循环 → 落地 → 待机，以及各状态间的过渡。',
    'Zıplama başı → havada döngü → iniş → bekleme; durumlar arası geçişler.'
  ],
  'system.statemachine.what': [
    'An Animation Blueprint state machine chooses clips by character state (grounded, airborne, landing) and manages transitions.',
    '动画蓝图状态机根据角色状态（地面、空中、落地）选择片段并管理过渡。',
    'Animasyon Blueprint içindeki durum makinesi, karakterin durumuna göre (yerde, havada, iniyor) hangi klibin/sistemin oynayacağını seçer ve geçişleri yönetir.'
  ],
  'system.statemachine.when': [
    'Staged movements such as jumping, falling, climbing and taking cover.',
    '跳跃、下落、攀爬、进入掩体等分阶段动作。',
    'Zıplama, düşme, tırmanma, siper alma gibi aşamalı her hareket.'
  ],
  'system.statemachine.pro': [
    'Separate Start, Loop and Land clips; match endpoint poses and transition on remaining time or ground contact.',
    '分别制作起跳、空中循环及落地片段，匹配相邻姿势，并按剩余时间或触地条件过渡。',
    'Her aşama ayrı klip: Start (tek sefer) → Loop (havada, döngü) → Land (tek sefer). Uçlar komşu durumun pozuyla eşleşir; geçişler “time remaining” veya yere değme koşuluyla.'
  ],
  'system.statemachine.auto': [
    'Match jump start to idle, generate airborne loop and landing back to idle; configure Unreal clips/loop flags and write a wiring guide.',
    '将起跳与待机姿势匹配，生成空中循环及返回待机的落地动作；设置 Unreal 片段和循环标记，并生成连接指南。',
    'Bekleme pozundan başlayan Start’ı, havada döngüyü ve beklemeye dönen Land’i poz eşlemeyle üretir; Unreal’da klipleri ve döngü bayraklarını kurar, durum makinesi bağlantı rehberi yazar.'
  ],
  'system.statemachine.limits': [
    'Python cannot draw the AnimBP graph. Wire states manually using the guide (~5 minutes). CharacterMovement controls jump height.',
    'Python 无法绘制 AnimBP 图。需按指南手动连接状态（约 5 分钟）；跳跃高度由 CharacterMovement 控制。',
    'AnimBP grafiği Python ile çizilemiyor; durumları rehbere göre elle bağlaman gerekir (~5 dk). Fiziksel zıplama yüksekliğini CharacterMovement belirler.'
  ],
  'system.aimoffset.title': ['Aim offset', '瞄准偏移', 'Nişan Ofseti'],
  'system.aimoffset.short': [
    'Upper-body aiming poses (up/down/left/right) layered over locomotion.',
    '将上半身的上下左右瞄准姿势叠加在移动动画上。',
    'Üst gövdenin bakılan yere dönmesi: yukarı/aşağı/sola/sağa nişan pozları, lokomosyonun üstüne eklenir.'
  ],
  'system.aimoffset.what': [
    'Nine poses stored as differences from a central reference, blended by camera angle over walking/running.',
    '以中心姿势为参考保存 9 个叠加姿势，根据相机角度混合并叠加到行走或奔跑动作上。',
    'Merkez poza göre fark (additive) olarak tutulan 9 poz. Kamera açısına göre karışıp yürüme/koşmanın üstüne bindirilir.'
  ],
  'system.aimoffset.when': [
    'Armed characters, head/body tracking and looking around inside vehicles.',
    '持武器角色、头部或躯干跟踪目标，以及车内环顾。',
    'Silahlı karakterler, kafanın/gövdenin hedefe bakması, araçta bakınma.'
  ],
  'system.aimoffset.pro': [
    'Prepare a 3×3 pose grid through mocap or by hand, then convert to mesh-space additive relative to the center.',
    '通过动作捕捉或手工制作 3×3 姿势网格，以中心姿势为参考转换为网格空间叠加动画。',
    'Mocap veya elle 9 poz (3×3) hazırlanır, merkez poz referans alınarak “mesh space additive” yapılır.'
  ],
  'system.aimoffset.auto': [
    'Generate a central pose, lock the other eight lower bodies to it, configure mesh-space additive sequences and create an AO_ asset.',
    '生成中心姿势，将另外八个姿势的下半身锁定到中心姿势，设置网格空间叠加序列并创建 AO_ 资源。',
    'Merkez pozu üretip diğer 8 pozun alt gövdesini aynı poza kilitler; Unreal’da sekansları additive (mesh space, referans = merkez) yapıp AO_ asset’ini kurar.'
  ],
  'system.aimoffset.limits': [
    'Kimodo angles are approximate. Use Control Rig corrections for precise aiming.',
    'Kimodo 生成的角度为近似值。精确瞄准建议使用 Control Rig 修正。',
    'Kimodo açıyı derece hassasiyetinde tutturamaz; açılar yaklaşık olur. Hassas nişan için Control Rig ile düzeltme önerilir.'
  ],
  'system.motionmatching.title': ['Motion matching', '运动匹配', 'Motion Matching'],
  'system.motionmatching.short': [
    'Each frame searches hundreds of short clips for the best match to the current pose and intended direction.',
    '每帧从数百个短片段中寻找最匹配当前姿势和目标方向的时刻。',
    'Yüzlerce kısa klip arasından her karede mevcut poza ve gidilecek yöne en uygun anı bulur.'
  ],
  'system.motionmatching.what': [
    'Search a database using current pose, feet, hip velocity and future trajectory, then jump to the best clip moment. Richer data produces more natural motion without manual transitions.',
    '根据当前姿势、足部、髋部速度和未来轨迹搜索数据库，跳到最匹配的片段时刻。数据越丰富，动作越自然，无需手工搭建过渡。',
    'Sistem her karede karakterin şu anki pozunu (ayaklar, kalça hızı) ve gelecekteki yolunu (trajektori) bir veritabanında arar, en uygun klibin en uygun anına atlar. Geçişleri elle kurmazsın; veri ne kadar zenginse hareket o kadar doğal.'
  ],
  'system.motionmatching.when': [
    'AAA locomotion with sudden stops, turns, pivots and curves in Unreal 5.4+ (used by Game Animation Sample).',
    '适用于 Unreal 5.4+ 的 AAA 级移动，支持急停、转向、急转和弧线；Game Animation Sample 也使用此方案。',
    'AAA kalitesinde lokomosyon: ani durma, dönme, pivot, kavis — Unreal 5.4+ (Game Animation Sample bunu kullanır).'
  ],
  'system.motionmatching.pro': [
    'A dance card captures loops, starts, stops, turns, pivots and circles at each speed with consistent style and root motion. GASP contains about 500 clips.',
    '使用动作采集清单，为各速度录制循环、起步、停止、转身、急转和绕圈，保持风格一致并包含根运动。GASP 约有 500 个片段。',
    '“Dans kartı” denen bir çekim listesi kullanılır: her hız için döngüler, başlangıçlar (0/90/180), duruşlar, yerinde dönüşler, pivotlar, daireler. Hepsi root motion’lı ve aynı stilde olmalı. GASP’ta ~500 klip var.'
  ],
  'system.motionmatching.auto': [
    'Generate a consistent dance card with constrained root paths and matched endpoints. Create an Unreal Schema with trajectory/foot/hip channels and add every clip to its Database.',
    '按统一风格生成动作清单，约束根路径并匹配首尾姿势。在 Unreal 创建包含轨迹、足部和髋部通道的 Schema，将所有片段添加到数据库。',
    'Dans kartını tek stil öznesiyle üretir: döngüleri tam hızda kök yoluyla, başlangıç/duruş/pivotları komşu döngünün ve beklemenin pozlarıyla kilitleyerek (poz eşleme) zincirler. Unreal’da Schema (trajektori + ayak/kalça kanalları) ve Database’i kurup tüm klipleri ekler.'
  ],
  'system.motionmatching.limits': [
    'The character Blueprint needs a Motion Matching node and trajectory component (copyable from GASP). Add seed variations to expand the dataset and improve quality.',
    '角色蓝图需要运动匹配节点和轨迹组件（可从 GASP 复制）。建议增加不同种子的动作变体以扩充数据并提升质量。',
    'Karakter Blueprint’inde Motion Matching düğümü + trajektori bileşeni gerekir (GASP’tan kopyalanabilir). Kalite veri miktarıyla artar: kartı varyasyonlarla büyütmek (aynı klip farklı tohum) önerilir.'
  ],
  'system.single.main.label': ['Clip', '片段', 'Klip'],
  'system.single.main.group': ['Clip', '片段', 'Klip'],
  'system.montage.idle.label': ['Idle', '待机', 'Bekleme'],
  'system.montage.idle.group': ['Loops', '循环', 'Döngüler'],
  'system.montage.pickup.label': ['Pick up', '拾取', 'Yerden al'],
  'system.montage.pickup.group': ['Actions', '动作', 'Aksiyonlar'],
  'system.montage.push_door.label': ['Push door', '推门', 'Kapı it'],
  'system.montage.push_door.group': ['Actions', '动作', 'Aksiyonlar'],
  'system.montage.hit_front.label': ['Front hit', '正面受击', 'Önden darbe'],
  'system.montage.hit_front.group': ['Actions', '动作', 'Aksiyonlar'],
  'system.blendspace1d.idle.label': ['Idle', '待机', 'Bekleme'],
  'system.blendspace1d.idle.group': ['Loops', '循环', 'Döngüler'],
  'system.blendspace1d.walk_fwd.label': ['Walk forward', '行走 向前', 'Yürü ileri'],
  'system.blendspace1d.walk_fwd.group': ['Loops', '循环', 'Döngüler'],
  'system.blendspace1d.jog_fwd.label': ['Jog forward', '慢跑 向前', 'Koş (jog) ileri'],
  'system.blendspace1d.jog_fwd.group': ['Loops', '循环', 'Döngüler'],
  'system.blendspace1d.run_fwd.label': ['Run forward', '快跑 向前', 'Koş (hızlı) ileri'],
  'system.blendspace1d.run_fwd.group': ['Loops', '循环', 'Döngüler'],
  'system.blendspace2d.idle.label': ['Idle', '待机', 'Bekleme'],
  'system.blendspace2d.idle.group': ['Loops', '循环', 'Döngüler'],
  'system.blendspace2d.walk_fwd.label': ['Walk forward', '行走 向前', 'Yürü ileri'],
  'system.blendspace2d.walk_fwd.group': ['Loops', '循环', 'Döngüler'],
  'system.blendspace2d.walk_right.label': ['Walk right', '行走 向右', 'Yürü sağa'],
  'system.blendspace2d.walk_right.group': ['Loops', '循环', 'Döngüler'],
  'system.blendspace2d.walk_left.label': ['Walk left', '行走 向左', 'Yürü sola'],
  'system.blendspace2d.walk_left.group': ['Loops', '循环', 'Döngüler'],
  'system.blendspace2d.walk_back.label': ['Walk backward', '行走 向后', 'Yürü geri'],
  'system.blendspace2d.walk_back.group': ['Loops', '循环', 'Döngüler'],
  'system.blendspace2d.jog_fwd.label': ['Jog forward', '慢跑 向前', 'Koş (jog) ileri'],
  'system.blendspace2d.jog_fwd.group': ['Loops', '循环', 'Döngüler'],
  'system.blendspace2d.jog_right.label': ['Jog right', '慢跑 向右', 'Koş (jog) sağa'],
  'system.blendspace2d.jog_right.group': ['Loops', '循环', 'Döngüler'],
  'system.blendspace2d.jog_left.label': ['Jog left', '慢跑 向左', 'Koş (jog) sola'],
  'system.blendspace2d.jog_left.group': ['Loops', '循环', 'Döngüler'],
  'system.blendspace2d.jog_back.label': ['Jog backward', '慢跑 向后', 'Koş (jog) geri'],
  'system.blendspace2d.jog_back.group': ['Loops', '循环', 'Döngüler'],
  'system.statemachine.idle.label': ['Idle', '待机', 'Bekleme'],
  'system.statemachine.idle.group': ['Loops', '循环', 'Döngüler'],
  'system.statemachine.jump_start.label': ['Jump start', '起跳', 'Zıplama başı'],
  'system.statemachine.jump_start.group': ['Jump', '跳跃', 'Zıplama'],
  'system.statemachine.jump_loop.label': ['Airborne', '空中', 'Havada'],
  'system.statemachine.jump_loop.group': ['Jump', '跳跃', 'Zıplama'],
  'system.statemachine.land.label': ['Landing', '落地', 'İniş'],
  'system.statemachine.land.group': ['Jump', '跳跃', 'Zıplama'],
  'system.aimoffset.aim_ul.label': ['Up Left', '上 左', 'Yukarı Sol'],
  'system.aimoffset.aim_ul.group': ['Nişan', 'Nişan', 'Nişan'],
  'system.aimoffset.aim_uc.label': ['Up', '上', 'Yukarı'],
  'system.aimoffset.aim_uc.group': ['Nişan', 'Nişan', 'Nişan'],
  'system.aimoffset.aim_ur.label': ['Up Right', '上 右', 'Yukarı Sağ'],
  'system.aimoffset.aim_ur.group': ['Nişan', 'Nişan', 'Nişan'],
  'system.aimoffset.aim_cl.label': ['Left', '左', 'Sol'],
  'system.aimoffset.aim_cl.group': ['Nişan', 'Nişan', 'Nişan'],
  'system.aimoffset.aim_cc.label': ['Center', '中心', 'Merkez'],
  'system.aimoffset.aim_cc.group': ['Nişan', 'Nişan', 'Nişan'],
  'system.aimoffset.aim_cr.label': ['Right', '右', 'Sağ'],
  'system.aimoffset.aim_cr.group': ['Nişan', 'Nişan', 'Nişan'],
  'system.aimoffset.aim_dl.label': ['Down Left', '下 左', 'Aşağı Sol'],
  'system.aimoffset.aim_dl.group': ['Nişan', 'Nişan', 'Nişan'],
  'system.aimoffset.aim_dc.label': ['Down', '下', 'Aşağı'],
  'system.aimoffset.aim_dc.group': ['Nişan', 'Nişan', 'Nişan'],
  'system.aimoffset.aim_dr.label': ['Down Right', '下 右', 'Aşağı Sağ'],
  'system.aimoffset.aim_dr.group': ['Nişan', 'Nişan', 'Nişan'],
  'system.motionmatching.idle.label': ['Idle', '待机', 'Bekleme'],
  'system.motionmatching.idle.group': ['Loops', '循环', 'Döngüler'],
  'system.motionmatching.walk_fwd.label': ['Walk forward', '行走 向前', 'Yürü ileri'],
  'system.motionmatching.walk_fwd.group': ['Loops', '循环', 'Döngüler'],
  'system.motionmatching.walk_back.label': ['Walk backward', '行走 向后', 'Yürü geri'],
  'system.motionmatching.walk_back.group': ['Loops', '循环', 'Döngüler'],
  'system.motionmatching.walk_left.label': ['Walk left', '行走 向左', 'Yürü sola'],
  'system.motionmatching.walk_left.group': ['Loops', '循环', 'Döngüler'],
  'system.motionmatching.walk_right.label': ['Walk right', '行走 向右', 'Yürü sağa'],
  'system.motionmatching.walk_right.group': ['Loops', '循环', 'Döngüler'],
  'system.motionmatching.jog_fwd.label': ['Jog forward', '慢跑 向前', 'Koş (jog) ileri'],
  'system.motionmatching.jog_fwd.group': ['Loops', '循环', 'Döngüler'],
  'system.motionmatching.jog_back.label': ['Jog backward', '慢跑 向后', 'Koş (jog) geri'],
  'system.motionmatching.jog_back.group': ['Loops', '循环', 'Döngüler'],
  'system.motionmatching.jog_left.label': ['Jog left', '慢跑 向左', 'Koş (jog) sola'],
  'system.motionmatching.jog_left.group': ['Loops', '循环', 'Döngüler'],
  'system.motionmatching.jog_right.label': ['Jog right', '慢跑 向右', 'Koş (jog) sağa'],
  'system.motionmatching.jog_right.group': ['Loops', '循环', 'Döngüler'],
  'system.motionmatching.walk_start_0.label': ['Walk start', '行走 起步', 'Yürü başla'],
  'system.motionmatching.walk_start_0.group': ['Starts', '起步', 'Başlangıçlar'],
  'system.motionmatching.walk_start_l90.label': ['Walk start 90° left', '行走 起步 90° 左', 'Yürü başla 90° sol'],
  'system.motionmatching.walk_start_l90.group': ['Starts', '起步', 'Başlangıçlar'],
  'system.motionmatching.walk_start_r90.label': ['Walk start 90° right', '行走 起步 90° 右', 'Yürü başla 90° sağ'],
  'system.motionmatching.walk_start_r90.group': ['Starts', '起步', 'Başlangıçlar'],
  'system.motionmatching.walk_start_180.label': ['Walk start 180°', '行走 起步 180°', 'Yürü başla 180°'],
  'system.motionmatching.walk_start_180.group': ['Starts', '起步', 'Başlangıçlar'],
  'system.motionmatching.jog_start_0.label': ['Jog start', '慢跑 起步', 'Koş başla'],
  'system.motionmatching.jog_start_0.group': ['Starts', '起步', 'Başlangıçlar'],
  'system.motionmatching.jog_start_180.label': ['Jog start 180°', '慢跑 起步 180°', 'Koş başla 180°'],
  'system.motionmatching.jog_start_180.group': ['Starts', '起步', 'Başlangıçlar'],
  'system.motionmatching.walk_stop.label': ['Walk stop', '行走 停止', 'Yürü dur'],
  'system.motionmatching.walk_stop.group': ['Stops', '停止', 'Duruşlar'],
  'system.motionmatching.jog_stop.label': ['Jog stop', '慢跑 停止', 'Koş dur'],
  'system.motionmatching.jog_stop.group': ['Stops', '停止', 'Duruşlar'],
  'system.motionmatching.turn_l90.label': ['In place 90° left', '原地 90° 左', 'Yerinde 90° sol'],
  'system.motionmatching.turn_l90.group': ['Turns', '转身', 'Dönüşler'],
  'system.motionmatching.turn_r90.label': ['In place 90° right', '原地 90° 右', 'Yerinde 90° sağ'],
  'system.motionmatching.turn_r90.group': ['Turns', '转身', 'Dönüşler'],
  'system.motionmatching.turn_180.label': ['In place 180°', '原地 180°', 'Yerinde 180°'],
  'system.motionmatching.turn_180.group': ['Turns', '转身', 'Dönüşler'],
  'system.motionmatching.walk_pivot.label': ['Walk pivot 180°', '行走 急转 180°', 'Yürü pivot 180°'],
  'system.motionmatching.walk_pivot.group': ['Pivots', '急转', 'Pivotlar'],
  'system.motionmatching.jog_pivot.label': ['Jog pivot 180°', '慢跑 急转 180°', 'Koş pivot 180°'],
  'system.motionmatching.jog_pivot.group': ['Pivots', '急转', 'Pivotlar'],
  'system.motionmatching.walk_circle_l.label': ['Walk curve left', '行走 弧线 左', 'Yürü kavis sol'],
  'system.motionmatching.walk_circle_l.group': ['Curves', '弧线', 'Kavisler'],
  'system.motionmatching.walk_circle_r.label': ['Walk curve right', '行走 弧线 右', 'Yürü kavis sağ'],
  'system.motionmatching.walk_circle_r.group': ['Curves', '弧线', 'Kavisler'],
  'system.motionmatching.jog_circle_l.label': ['Jog curve left', '慢跑 弧线 左', 'Koş kavis sol'],
  'system.motionmatching.jog_circle_l.group': ['Curves', '弧线', 'Kavisler'],
  'system.motionmatching.jog_circle_r.label': ['Jog curve right', '慢跑 弧线 右', 'Koş kavis sağ'],
  'system.motionmatching.jog_circle_r.group': ['Curves', '弧线', 'Kavisler'],
  'system.word.Bekleme': ['Idle', '待机', 'Bekleme'],
  'system.word.Döngüler': ['Loops', '循环', 'Döngüler'],
  'system.word.Klip': ['Clip', '片段', 'Klip'],
  'system.word.Aksiyonlar': ['Actions', '动作', 'Aksiyonlar'],
  'system.word.Başlangıçlar': ['Starts', '起步', 'Başlangıçlar'],
  'system.word.Duruşlar': ['Stops', '停止', 'Duruşlar'],
  'system.word.Dönüşler': ['Turns', '转身', 'Dönüşler'],
  'system.word.Pivotlar': ['Pivots', '急转', 'Pivotlar'],
  'system.word.Kavisler': ['Curves', '弧线', 'Kavisler'],
  'system.word.Zıplama': ['Jump', '跳跃', 'Zıplama'],
  'system.word.Yerden al': ['Pick up', '拾取', 'Yerden al'],
  'system.word.Kapı it': ['Push door', '推门', 'Kapı it'],
  'system.word.Önden darbe': ['Front hit', '正面受击', 'Önden darbe'],
  'system.word.Zıplama başı': ['Jump start', '起跳', 'Zıplama başı'],
  'system.word.Havada': ['Airborne', '空中', 'Havada'],
  'system.word.İniş': ['Landing', '落地', 'İniş'],
  'system.word.Speed': ['Speed', '速度', 'Speed'],
  'system.word.Direction': ['Direction', '方向', 'Direction'],
  'system.word.Yaw': ['Yaw', '偏航', 'Yaw'],
  'system.word.Pitch': ['Pitch', '俯仰', 'Pitch']
} as const
