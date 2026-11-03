// SPDX-License-Identifier: AGPL-3.0-only
// Animasyon sistemleri kataloğu — oyunlarda yaygın kullanılan yapılar, ne işe yaradıkları,
// profesyonellerin nasıl ürettiği ve AssetForge'un neyi otomatikleştirdiği.
// Klip promptlarında {S} = sistemin stil öznesi ("A person", "A tired soldier" ...).

import type { AnimClipRole, AnimSystem, AnimSystemAxis, AnimSystemClip, AnimSystemKind } from './types'

export interface AnimSystemInfo {
  kind: AnimSystemKind
  title: string
  /** UE'deki karşılığı */
  ue: string
  short: string
  what: string
  when: string
  pro: string
  auto: string
  /** Dürüst sınırlar */
  limits: string
  icon: string
  axes?: { x: AnimSystemAxis; y?: AnimSystemAxis }
  clips: () => AnimSystemClip[]
}

export const SPEED = { walk: 1.5, jog: 3.2, run: 5.0 }

function clip(key: string, label: string, group: string, role: AnimClipRole, prompt: string, o: Partial<AnimSystemClip> = {}): AnimSystemClip {
  const loop = o.loop ?? (role === 'idle' || role === 'loop' || role === 'jump_loop')
  return {
    key,
    label,
    group,
    role,
    prompt,
    seconds: o.seconds ?? (role === 'idle' ? 3 : loop ? 1.2 : 1.6),
    loop,
    rootMotion: o.rootMotion ?? 'root',
    speed: 0,
    moveDir: 0,
    turn: 0,
    constrainPath: role !== 'action' && role !== 'other' && role !== 'jump_start' && role !== 'jump_loop' && role !== 'land',
    enabled: true,
    ...o
  }
}

const idle = (o: Partial<AnimSystemClip> = {}) => clip('idle', 'Bekleme', 'Döngüler', 'idle', '{S} stands still and breathes calmly, shifting weight slightly.', { seconds: 3, ...o })

function locoLoop(gait: 'walk' | 'jog' | 'run', dir: 0 | 90 | -90 | 180, o: Partial<AnimSystemClip> = {}): AnimSystemClip {
  const v = SPEED[gait]
  const verb = gait === 'walk' ? 'walks' : gait === 'jog' ? 'jogs' : 'runs'
  const tr = { walk: 'Yürü', jog: 'Koş (jog)', run: 'Koş (hızlı)' }[gait]
  const dirTxt = { 0: 'forward', 90: 'sideways to the right while facing forward', [-90]: 'sideways to the left while facing forward', 180: 'backward while facing forward' }[dir]
  const dirTr = { 0: 'ileri', 90: 'sağa', [-90]: 'sola', 180: 'geri' }[dir]
  const key = `${gait}_${{ 0: 'fwd', 90: 'right', [-90]: 'left', 180: 'back' }[dir]}`
  return clip(key, `${tr} ${dirTr}`, 'Döngüler', 'loop', `{S} ${verb} ${dirTxt} at a steady pace.`, { speed: v, moveDir: dir, seconds: gait === 'walk' ? 1.2 : 0.8, ...o })
}

// ---------------------------------------------------------------------------

export const ANIM_SYSTEMS: AnimSystemInfo[] = [
  {
    kind: 'single',
    title: 'Tek Klip',
    ue: 'Animation Sequence',
    icon: 'film',
    short: 'Tek başına oynayan düz animasyon: döngü (bekleme) veya tek seferlik (selam, el sallama).',
    what: 'En temel animasyon varlığı. Belirli bir süre boyunca iskeletin her karesini tutar. Döngü (loop) olarak işaretlenirse başa sarar.',
    when: 'Ara sahneler, NPC davranışları, tek başına oynayan hareketler. Diğer tüm sistemler aslında bu kliplerden yapılır.',
    pro: 'Mocap stüdyosunda çekilir, MotionBuilder/Maya’da temizlenir (ayak kayması, gürültü), döngüyse ilk/son kare eşitlenir, Unreal’a FBX olarak girer.',
    auto: 'Kimodo metinden üretir; döngüyse en temiz döngü penceresini otomatik kesip dikişi kapatır, root motion ayarlar, karakterine retarget eder.',
    limits: 'Çok özel veya nadir hareketlerde (spor, akrobasi) Kimodo zayıf kalabilir.',
    clips: () => [clip('main', 'Klip', 'Klip', 'other', '{S} waves hello with the right hand.', { seconds: 3, loop: false, constrainPath: false })]
  },
  {
    kind: 'montage',
    title: 'Aksiyon Montajı',
    ue: 'Anim Montage (+ Slot)',
    icon: 'bolt',
    short: 'Kod/Blueprint ile tetiklenen tek seferlik aksiyonlar: kapı açma, eşya alma, darbe alma, saldırı.',
    what: 'Montage, bir veya birkaç sekansı “slot” üzerinden oynatır; bölümler (section), notify’lar (ör. hasar anı) ve root motion taşır. Lokomosyonun üstüne katmanlanabilir.',
    when: 'Etkileşimler, saldırılar, şarjör değiştirme, hasar tepkileri — oyuncu aksiyonu bittiğinde lokomosyona geri dönülen her şey.',
    pro: 'Her aksiyon ortak bir “bekleme pozundan” başlayıp ona döner; böylece blend in/out görünmez olur. Hasar/ses anları notify ile işaretlenir.',
    auto: 'Önce bekleme klibini üretir, sonra her aksiyonun ilk ve son karesini o bekleme pozuna kilitler (poz eşleme). Unreal’da her biri için AM_ montajı kurar.',
    limits: 'Silah/eşya tutan eller için IK hizalaması ve notify zamanları elle ince ayar ister.',
    clips: () => [
      idle(),
      clip('pickup', 'Yerden al', 'Aksiyonlar', 'action', '{S} bends down and picks up an object from the ground with the right hand.', { seconds: 2.4, from: 'idle', to: 'idle' }),
      clip('push_door', 'Kapı it', 'Aksiyonlar', 'action', '{S} pushes open a heavy door in front of them with both hands.', { seconds: 2.2, from: 'idle', to: 'idle' }),
      clip('hit_front', 'Önden darbe', 'Aksiyonlar', 'action', '{S} gets hit in the chest from the front and staggers back one step.', { seconds: 1.6, from: 'idle', to: 'idle' })
    ]
  },
  {
    kind: 'blendspace1d',
    title: 'Hız Blend Space (1D)',
    ue: 'Blend Space 1D',
    icon: 'sliders',
    short: 'Tek eksen (hız) üzerinde bekleme → yürüme → koşma arasında yumuşak geçiş.',
    what: 'Aynı ritimdeki döngüleri bir eksen üzerine yerleştirir; karakterin hızına göre iki komşu klibi ağırlıklı karıştırır. Hız kadar yavaşlatma/hızlandırma (rate scale) da yapabilir.',
    when: 'Basit lokomosyon: NPC’ler, kamera hep arkada olan oyunlar, hızlı prototip.',
    pro: 'Tüm döngüler aynı ayakla başlar ve “sync marker” (L/R ayak basışı) taşır; böylece karışırken ayaklar çakışmaz. Örnekler eksene gerçek hızlarında konur, yoksa ayak kayar.',
    auto: 'Döngüleri hedef hızda kök yolu kısıtıyla üretir, sol ayak basışından kesip L/R sync marker’larını Kimodo ayak temaslarından otomatik ekler, örnekleri ölçülen gerçek hıza (cm/sn) yerleştirir.',
    limits: 'Yön değişimi yok; dönüşler kapsülün dönmesiyle olur (ayak kayabilir). Daha iyisi için 2D veya Motion Matching.',
    axes: { x: { name: 'Speed', min: 0, max: 600, grid: 6 } },
    clips: () => [idle({ rootMotion: 'inplace' }), locoLoop('walk', 0, { rootMotion: 'inplace' }), locoLoop('jog', 0, { rootMotion: 'inplace' }), locoLoop('run', 0, { rootMotion: 'inplace' })]
  },
  {
    kind: 'blendspace2d',
    title: 'Yön × Hız Blend Space (2D)',
    ue: 'Blend Space (2D)',
    icon: 'grid',
    short: 'Yön (-180…180) ve hız eksenleri: ileri, geri, yanlara (strafe) yürüme/koşma karışımı.',
    what: 'Klipleri iki boyutlu bir ızgaraya yerleştirir; hem hıza hem de bakışa göre hareket yönüne göre karıştırır. Nişan alırken yanlama (strafe) için standarttır.',
    when: 'TPS/FPS karakterler, nişan alırken hareket, her yöne dönmeden yürüyen düşmanlar.',
    pro: 'Her yön ve hız için ayrı döngü çekilir (genelde 8 yön × 2-3 hız); geri yön ızgarada hem -180 hem 180’e konur. Hepsi sync marker ile senkronlanır.',
    auto: '4 yön × 2 hız + bekleme üretir; her klibi istenen yön ve hızda kök yolu ile kilitler, ölçülen gerçek değerlere yerleştirir, 180 klibini -180’e de kopyalar, sync marker ekler.',
    limits: 'Çapraz yönler (45°) iki komşu klibin karışımıyla oluşur; çok hassas oyunlarda 8 yön önerilir (kartı genişletebilirsin).',
    axes: { x: { name: 'Direction', min: -180, max: 180, grid: 8 }, y: { name: 'Speed', min: 0, max: 400, grid: 4 } },
    clips: () => [idle({ rootMotion: 'inplace' }), ...(['walk', 'jog'] as const).flatMap((g) => ([0, 90, -90, 180] as const).map((d) => locoLoop(g, d, { rootMotion: 'inplace' })))]
  },
  {
    kind: 'statemachine',
    title: 'Zıplama Durum Makinesi',
    ue: 'AnimBP State Machine',
    icon: 'flow',
    short: 'Zıplama başı → havada döngü → iniş → bekleme; durumlar arası geçişler.',
    what: 'Animasyon Blueprint içindeki durum makinesi, karakterin durumuna göre (yerde, havada, iniyor) hangi klibin/sistemin oynayacağını seçer ve geçişleri yönetir.',
    when: 'Zıplama, düşme, tırmanma, siper alma gibi aşamalı her hareket.',
    pro: 'Her aşama ayrı klip: Start (tek sefer) → Loop (havada, döngü) → Land (tek sefer). Uçlar komşu durumun pozuyla eşleşir; geçişler “time remaining” veya yere değme koşuluyla.',
    auto: 'Bekleme pozundan başlayan Start’ı, havada döngüyü ve beklemeye dönen Land’i poz eşlemeyle üretir; Unreal’da klipleri ve döngü bayraklarını kurar, durum makinesi bağlantı rehberi yazar.',
    limits: 'AnimBP grafiği Python ile çizilemiyor; durumları rehbere göre elle bağlaman gerekir (~5 dk). Fiziksel zıplama yüksekliğini CharacterMovement belirler.',
    clips: () => [
      idle({ rootMotion: 'inplace' }),
      clip('jump_start', 'Zıplama başı', 'Zıplama', 'jump_start', '{S} jumps straight up from a standing position, pushing off with both legs.', { seconds: 0.8, from: 'idle', rootMotion: 'inplace' }),
      clip('jump_loop', 'Havada', 'Zıplama', 'jump_loop', '{S} is falling through the air with knees slightly bent and arms out for balance.', { seconds: 1.0, rootMotion: 'inplace' }),
      clip('land', 'İniş', 'Zıplama', 'land', '{S} lands on both feet from a jump, absorbs the impact and stands up.', { seconds: 1.2, to: 'idle', rootMotion: 'inplace' })
    ]
  },
  {
    kind: 'aimoffset',
    title: 'Nişan Ofseti',
    ue: 'Aim Offset',
    icon: 'target',
    short: 'Üst gövdenin bakılan yere dönmesi: yukarı/aşağı/sola/sağa nişan pozları, lokomosyonun üstüne eklenir.',
    what: 'Merkez poza göre fark (additive) olarak tutulan 9 poz. Kamera açısına göre karışıp yürüme/koşmanın üstüne bindirilir.',
    when: 'Silahlı karakterler, kafanın/gövdenin hedefe bakması, araçta bakınma.',
    pro: 'Mocap veya elle 9 poz (3×3) hazırlanır, merkez poz referans alınarak “mesh space additive” yapılır.',
    auto: 'Merkez pozu üretip diğer 8 pozun alt gövdesini aynı poza kilitler; Unreal’da sekansları additive (mesh space, referans = merkez) yapıp AO_ asset’ini kurar.',
    limits: 'Kimodo açıyı derece hassasiyetinde tutturamaz; açılar yaklaşık olur. Hassas nişan için Control Rig ile düzeltme önerilir.',
    axes: { x: { name: 'Yaw', min: -90, max: 90, grid: 2 }, y: { name: 'Pitch', min: -60, max: 60, grid: 2 } },
    clips: () => {
      const out: AnimSystemClip[] = []
      for (const pitch of [60, 0, -60])
        for (const yaw of [-90, 0, 90]) {
          const c = yaw === 0 && pitch === 0
          const v = pitch > 0 ? 'up' : pitch < 0 ? 'down' : ''
          const h = yaw < 0 ? 'to the left' : yaw > 0 ? 'to the right' : ''
          const where = [v, h].filter(Boolean).join(' and ') || 'straight ahead'
          const tr = [pitch > 0 ? 'Yukarı' : pitch < 0 ? 'Aşağı' : '', yaw < 0 ? 'Sol' : yaw > 0 ? 'Sağ' : ''].filter(Boolean).join(' ') || 'Merkez'
          out.push(
            clip(c ? 'aim_cc' : `aim_${pitch > 0 ? 'u' : pitch < 0 ? 'd' : 'c'}${yaw < 0 ? 'l' : yaw > 0 ? 'r' : 'c'}`, tr, 'Nişan', 'aim', `{S} stands still holding a rifle and aims ${where}.`, {
              seconds: 1,
              loop: false,
              rootMotion: 'inplace',
              aim: { yaw, pitch },
              sample: { x: yaw, y: pitch },
              from: c ? undefined : 'aim_cc'
            })
          )
        }
      return out
    }
  },
  {
    kind: 'motionmatching',
    title: 'Motion Matching',
    ue: 'Pose Search Database + Schema',
    icon: 'matrix',
    short: 'Yüzlerce kısa klip arasından her karede mevcut poza ve gidilecek yöne en uygun anı bulur.',
    what: 'Sistem her karede karakterin şu anki pozunu (ayaklar, kalça hızı) ve gelecekteki yolunu (trajektori) bir veritabanında arar, en uygun klibin en uygun anına atlar. Geçişleri elle kurmazsın; veri ne kadar zenginse hareket o kadar doğal.',
    when: 'AAA kalitesinde lokomosyon: ani durma, dönme, pivot, kavis — Unreal 5.4+ (Game Animation Sample bunu kullanır).',
    pro: '“Dans kartı” denen bir çekim listesi kullanılır: her hız için döngüler, başlangıçlar (0/90/180), duruşlar, yerinde dönüşler, pivotlar, daireler. Hepsi root motion’lı ve aynı stilde olmalı. GASP’ta ~500 klip var.',
    auto: 'Dans kartını tek stil öznesiyle üretir: döngüleri tam hızda kök yoluyla, başlangıç/duruş/pivotları komşu döngünün ve beklemenin pozlarıyla kilitleyerek (poz eşleme) zincirler. Unreal’da Schema (trajektori + ayak/kalça kanalları) ve Database’i kurup tüm klipleri ekler.',
    limits:
      'Karakter Blueprint’inde Motion Matching düğümü + trajektori bileşeni gerekir (GASP’tan kopyalanabilir). Kalite veri miktarıyla artar: kartı varyasyonlarla büyütmek (aynı klip farklı tohum) önerilir.',
    clips: () => {
      const w = SPEED.walk
      const j = SPEED.jog
      const g = (k: string, l: string, grp: string, role: AnimClipRole, p: string, o: Partial<AnimSystemClip>) => clip(k, l, grp, role, p, o)
      return [
        idle(),
        locoLoop('walk', 0),
        locoLoop('walk', 180),
        locoLoop('walk', -90),
        locoLoop('walk', 90),
        locoLoop('jog', 0),
        locoLoop('jog', 180),
        locoLoop('jog', -90),
        locoLoop('jog', 90),
        g('walk_start_0', 'Yürü başla', 'Başlangıçlar', 'start', '{S} starts walking forward from standing still.', { speed: 0, speedEnd: w, from: 'idle', to: 'walk_fwd', seconds: 1.4 }),
        g('walk_start_l90', 'Yürü başla 90° sol', 'Başlangıçlar', 'start', '{S} turns 90 degrees to the left and starts walking.', {
          speed: 0,
          speedEnd: w,
          turn: -90,
          from: 'idle',
          to: 'walk_fwd',
          seconds: 1.6
        }),
        g('walk_start_r90', 'Yürü başla 90° sağ', 'Başlangıçlar', 'start', '{S} turns 90 degrees to the right and starts walking.', {
          speed: 0,
          speedEnd: w,
          turn: 90,
          from: 'idle',
          to: 'walk_fwd',
          seconds: 1.6
        }),
        g('walk_start_180', 'Yürü başla 180°', 'Başlangıçlar', 'start', '{S} turns around 180 degrees and starts walking.', {
          speed: 0,
          speedEnd: w,
          turn: 180,
          from: 'idle',
          to: 'walk_fwd',
          seconds: 1.8
        }),
        g('jog_start_0', 'Koş başla', 'Başlangıçlar', 'start', '{S} starts jogging forward from standing still.', { speed: 0, speedEnd: j, from: 'idle', to: 'jog_fwd', seconds: 1.3 }),
        g('jog_start_180', 'Koş başla 180°', 'Başlangıçlar', 'start', '{S} turns around 180 degrees and starts jogging.', {
          speed: 0,
          speedEnd: j,
          turn: 180,
          from: 'idle',
          to: 'jog_fwd',
          seconds: 1.7
        }),
        g('walk_stop', 'Yürü dur', 'Duruşlar', 'stop', '{S} walking forward comes to a stop and stands still.', { speed: w, speedEnd: 0, from: 'walk_fwd', to: 'idle', seconds: 1.4 }),
        g('jog_stop', 'Koş dur', 'Duruşlar', 'stop', '{S} jogging forward slows down and comes to a stop.', { speed: j, speedEnd: 0, from: 'jog_fwd', to: 'idle', seconds: 1.5 }),
        g('turn_l90', 'Yerinde 90° sol', 'Dönüşler', 'turn', '{S} standing still turns in place 90 degrees to the left.', { turn: -90, from: 'idle', to: 'idle', seconds: 1.4 }),
        g('turn_r90', 'Yerinde 90° sağ', 'Dönüşler', 'turn', '{S} standing still turns in place 90 degrees to the right.', { turn: 90, from: 'idle', to: 'idle', seconds: 1.4 }),
        g('turn_180', 'Yerinde 180°', 'Dönüşler', 'turn', '{S} standing still turns around 180 degrees in place.', { turn: 180, from: 'idle', to: 'idle', seconds: 1.8 }),
        g('walk_pivot', 'Yürü pivot 180°', 'Pivotlar', 'pivot', '{S} walking forward plants a foot and quickly turns around to walk the opposite way.', {
          speed: w,
          speedEnd: w,
          turn: 180,
          from: 'walk_fwd',
          to: 'walk_fwd',
          seconds: 1.6
        }),
        g('jog_pivot', 'Koş pivot 180°', 'Pivotlar', 'pivot', '{S} jogging forward plants a foot and quickly turns around to jog the opposite way.', {
          speed: j,
          speedEnd: j,
          turn: 180,
          from: 'jog_fwd',
          to: 'jog_fwd',
          seconds: 1.5
        }),
        g('walk_circle_l', 'Yürü kavis sol', 'Kavisler', 'loop', '{S} walks in a wide circle to the left.', { speed: w, turn: -40, seconds: 1.2 }),
        g('walk_circle_r', 'Yürü kavis sağ', 'Kavisler', 'loop', '{S} walks in a wide circle to the right.', { speed: w, turn: 40, seconds: 1.2 }),
        g('jog_circle_l', 'Koş kavis sol', 'Kavisler', 'loop', '{S} jogs in a wide circle to the left.', { speed: j, turn: -35, seconds: 0.8 }),
        g('jog_circle_r', 'Koş kavis sağ', 'Kavisler', 'loop', '{S} jogs in a wide circle to the right.', { speed: j, turn: 35, seconds: 0.8 })
      ]
    }
  }
]

export const animSystemInfo = (k: AnimSystemKind): AnimSystemInfo => ANIM_SYSTEMS.find((s) => s.kind === k) ?? ANIM_SYSTEMS[0]

/** Stil öznesini prompta yerleştir: "{S} walks" → "A tired soldier walks" */
export function stylePrompt(prompt: string, style: string): string {
  const s = (style || 'A person').trim().replace(/[.,;]+$/, '')
  const subj = /^(a|an|the)\s/i.test(s) ? s : `A ${s}`
  if (prompt.includes('{S}')) return prompt.split('{S}').join(subj)
  return prompt
}

export function newAnimSystem(kind: AnimSystemKind, characterId: string, name?: string, style = 'A person'): AnimSystem {
  const info = animSystemInfo(kind)
  const now = Date.now()
  return {
    id: 'sys_' + now.toString(36) + Math.random().toString(36).slice(2, 6),
    name: name || info.title,
    kind,
    characterId,
    style,
    description: '',
    clips: info.clips(),
    axes: info.axes ? JSON.parse(JSON.stringify(info.axes)) : undefined,
    createdAt: now,
    updatedAt: now
  }
}

/** Üretim sırası: önce bağımlı olunan klipler (poz eşleme kaynağı) */
export function productionPhases(sys: AnimSystem): AnimSystemClip[][] {
  const clips = sys.clips.filter((c) => c.enabled)
  const keys = new Set(clips.map((c) => c.key))
  const deps = (c: AnimSystemClip) => [c.from, c.to].filter((k): k is string => !!k && k !== c.key && keys.has(k))
  const done = new Set<string>()
  const phases: AnimSystemClip[][] = []
  let left = clips
  while (left.length) {
    const ready = left.filter((c) => deps(c).every((d) => done.has(d)))
    const ph = ready.length ? ready : left // döngüsel bağımlılık → kalanları birlikte
    phases.push(ph)
    for (const c of ph) done.add(c.key)
    left = left.filter((c) => !ph.includes(c))
  }
  return phases
}

/** Klip için UE'deki örnek koordinatı (ölçüm varsa ondan) */
export function sampleFor(sys: AnimSystem, c: AnimSystemClip, measured?: { speed: number; direction: number; displacementSpeed: number }): { x: number; y?: number } {
  if (c.sample) return c.sample
  const speedCm = Math.round(((measured ? (c.loop ? measured.displacementSpeed : measured.speed) : c.speed) || 0) * 100)
  if (sys.kind === 'blendspace1d') return { x: c.role === 'idle' ? 0 : speedCm }
  if (sys.kind === 'blendspace2d') {
    let dir = c.moveDir
    if (measured && c.role !== 'idle' && Math.abs(wrap(measured.direction - c.moveDir)) < 25) dir = Math.abs(c.moveDir) === 180 ? c.moveDir : Math.round(measured.direction)
    return { x: c.role === 'idle' ? 0 : dir, y: c.role === 'idle' ? 0 : speedCm }
  }
  if (sys.kind === 'aimoffset') return { x: c.aim?.yaw ?? 0, y: c.aim?.pitch ?? 0 }
  return { x: 0 }
}

export const wrap = (d: number): number => ((((d + 180) % 360) + 360) % 360) - 180
