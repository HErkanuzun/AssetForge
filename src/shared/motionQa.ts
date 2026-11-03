// SPDX-License-Identifier: AGPL-3.0-only
// Animasyon kalite kontrolü: BVH'den ayak kayması, zemine girme, titreme ve hedeflere uyum.
// Servis gerektirmez; hat içindeki "Kalite Kontrol" düğümü bunu kullanır ve sonuç kötüyse
// Kimodo düğümüne geri bildirim gönderip yeniden ürettirir.
import { findFeet, forwardKinematics, type Bvh } from './bvh'

export interface MotionMetrics {
  frames: number
  fps: number
  seconds: number
  /** Ayak yerdeyken parmak kökünün ortalama hızı (m/sn) — Kimodo'nun foot_skate_from_height ölçüsü */
  footSkate: number
  /** Yerdeki karelerin kaçında ayak belirgin kayıyor (0–1) */
  skateRatio: number
  /** Ayak zeminin en fazla ne kadar altına iniyor (m) */
  penetration: number
  /** Ayakların yere değdiği karelerin oranı (0–1) */
  contactRatio: number
  /** Ani hızlanma değişimi; eklem başına ortalama sarsıntı (m/sn³) */
  jitter: number
  /** Kopukluk: bir eklemin tek karede komşu karelerden ne kadar fazla sıçradığı (m), ör. kopuk geçiş */
  pop: number
}

export interface MotionTargets {
  /** Hedef hız (m/sn); ölçülen ile karşılaştırılır */
  speed?: number
  measuredSpeed?: number
  /** Hedef hareket yönü (derece, sağ +) */
  direction?: number
  measuredDirection?: number
  /** Hedef dönüş (derece, sağ +) */
  turn?: number
  measuredTurn?: number
  /** Döngü klibi: dikiş maliyeti (forge_motion.find_loop) */
  loopCost?: number
  /** Bekleme/oturma gibi ayakların yerde kalması beklenen hareket */
  stationary?: boolean
}

export interface MotionQa {
  metrics: MotionMetrics
  score: number
  pass: boolean
  /** Sorunlar (Türkçe, kullanıcıya) */
  issues: string[]
  /** Kimodo promptuna eklenecek İngilizce düzeltme */
  promptFix: string
  /** Rapor satırları */
  technical: string[]
}

export const QA_LIMITS = {
  /** m/sn: Kimodo demolarında 0.02–0.54; ayakları sürekli kayan klipte ~2.9 */
  skateWarn: 0.45,
  skateFail: 0.8,
  /** m */
  penetrationWarn: 0.03,
  penetrationFail: 0.08,
  /** m/sn³: Kimodo demolarında 35–420 (hızlı aksiyon yüksek) */
  jitterWarn: 600,
  jitterFail: 1200,
  /** m: komşu karelere göre ani sıçrama; Kimodo demolarında en çok 0.11 (hızlı el/ayak hareketi) */
  popFail: 0.2,
  speedTolerance: 0.3,
  angleTolerance: 30,
  loopCostWarn: 0.02
}

/** Kimodo'nun ölçüsüyle aynı: parmak y < 5 cm → yerde */
const CONTACT_HEIGHT = 0.05
const SKATE_SPEED = 0.3

function percentile(values: number[], p: number): number {
  const s = [...values].sort((a, b) => a - b)
  return s.length ? s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))] : 0
}

export function measureMotion(bvh: Bvh): MotionMetrics {
  const fps = bvh.frameTime > 0 ? 1 / bvh.frameTime : 30
  const pos = forwardKinematics(bvh)
  const T = pos.length
  const J = bvh.joints.length
  // Birim: kalça/kök yüksekliği 10'dan büyükse santimetre
  const rootIdx = bvh.joints.findIndex((j) => j.channels.some((c) => /position/i.test(c)) && /hip|pelvis/i.test(j.name))
  const ri = rootIdx >= 0 ? rootIdx : 0
  const height = percentile(
    pos.map((p) => p[ri][1]),
    0.5
  )
  const scale = Math.abs(height) > 10 ? 0.01 : 1
  const P = pos.map((frame) => frame.map(([x, y, z]) => [x * scale, y * scale, z * scale] as const))

  const feet = findFeet(bvh.joints)
  const toes = feet ? [feet.left.toe, feet.right.toe] : []
  // Zemin: Kimodo y=0 yazar; veri bununla uyumsuzsa (ör. havada başlayan klip) en alçak parmaklardan tahmin et
  const lowest = toes.length
    ? percentile(
        P.flatMap((f) => toes.map((t) => f[t][1])),
        0.02
      )
    : 0
  const floor = Math.abs(lowest) < 0.15 ? 0 : lowest

  let contact = 0
  let contactPairs = 0
  let skateSum = 0
  let skating = 0
  let minToe = Infinity
  for (const t of toes) {
    for (let f = 0; f < T; f++) {
      const y = P[f][t][1] - floor
      minToe = Math.min(minToe, y)
      const on = y < CONTACT_HEIGHT
      if (on) contact++
      // Kayma ölçüsü (GMD/MDM): 5 cm altındaki karelerde yatay hız, zemine yaklaştıkça artan ağırlıkla.
      // Böylece basış ve kalkış anındaki doğal parmak hareketi kayma sayılmaz.
      if (f > 0 && on) {
        const [x0, , z0] = P[f - 1][t]
        const [x1, , z1] = P[f][t]
        const v = Math.hypot(x1 - x0, z1 - z0) * fps
        const w = Math.max(0, Math.min(1, 2 - 2 ** (Math.max(0, y) / CONTACT_HEIGHT)))
        contactPairs += w
        skateSum += v * w
        if (v > SKATE_SPEED) skating += w
      }
    }
  }

  // Titreme: sarsıntı (üçüncü fark) — düzgün harekette küçük, kare kare titremede büyük
  let jerkSum = 0
  let jerkN = 0
  let pop = 0
  const step = (f: number, j: number) => Math.hypot(P[f][j][0] - P[f - 1][j][0], P[f][j][1] - P[f - 1][j][1], P[f][j][2] - P[f - 1][j][2])
  for (let f = 1; f < T; f++)
    for (let j = 0; j < J; j++) {
      if (bvh.joints[j].end) continue
      // Hızlı ama akıcı hareket (tekme, yumruk) komşu karelerde de büyüktür; kopukluk birkaç karede patlar.
      // Adımı, ±3 karelik komşu adımların medyanıyla karşılaştır (sıçrayıp geri dönmeyi de yakalar)
      if (f >= 4 && f < T - 3) {
        const around = [step(f - 3, j), step(f - 2, j), step(f - 1, j), step(f + 1, j), step(f + 2, j), step(f + 3, j)].sort((x, y) => x - y)
        pop = Math.max(pop, step(f, j) - (around[2] + around[3]) / 2)
      }
      if (f >= 3) {
        let s = 0
        for (let k = 0; k < 3; k++) s += (P[f][j][k] - 3 * P[f - 1][j][k] + 3 * P[f - 2][j][k] - P[f - 3][j][k]) ** 2
        jerkSum += Math.sqrt(s) * fps ** 3
        jerkN++
      }
    }

  const r = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d
  return {
    frames: T,
    fps: r(fps, 2),
    seconds: r((T - 1) / fps, 3),
    footSkate: r(contactPairs ? skateSum / contactPairs : 0),
    skateRatio: r(contactPairs ? skating / contactPairs : 0),
    penetration: r(toes.length ? Math.max(0, -minToe) : 0),
    contactRatio: r(toes.length && T ? contact / (toes.length * T) : 0),
    jitter: r(jerkN ? jerkSum / jerkN : 0, 1),
    pop: r(pop)
  }
}

const angleDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180)

/** Ölçümleri puana ve geri bildirime çevirir */
export function judgeMotion(m: MotionMetrics, targets: MotionTargets = {}, minScore = 7): MotionQa {
  // Hata seviyesindeki her sorun tek başına klibi kaldırır (-4); uyarılar ve hedef sapmaları birikir
  const L = QA_LIMITS
  const issues: string[] = []
  const fixes: string[] = []
  let score = 10
  const technical = [
    `Süre: ${m.seconds} sn, ${m.frames} kare @ ${m.fps} fps`,
    `Ayak kayması: ${m.footSkate} m/sn (yerdeki karelerin %${Math.round(m.skateRatio * 100)}'i kayıyor; uyarı ${L.skateWarn}, hata ${L.skateFail})`,
    `Zemine girme: ${Math.round(m.penetration * 100)} cm (uyarı ${L.penetrationWarn * 100}, hata ${L.penetrationFail * 100})`,
    `Titreme: ${m.jitter} m/sn³ (uyarı ${L.jitterWarn}, hata ${L.jitterFail}) · kopukluk ${Math.round(m.pop * 100)} cm`,
    `Ayak yerde: karelerin %${Math.round(m.contactRatio * 100)}'i`
  ]

  if (m.footSkate > L.skateFail) {
    score -= 4
    issues.push(`Ayaklar yerdeyken belirgin kayıyor (${m.footSkate} m/sn)`)
    fixes.push('feet stay firmly planted on the ground during each step, no sliding')
  } else if (m.footSkate > L.skateWarn) {
    score -= 2
    issues.push(`Hafif ayak kayması (${m.footSkate} m/sn)`)
    fixes.push('feet planted firmly on each step')
  }
  if (m.penetration > L.penetrationFail) {
    score -= 4
    issues.push(`Ayak zeminin ${Math.round(m.penetration * 100)} cm altına iniyor`)
    fixes.push('feet stay on the floor surface')
  } else if (m.penetration > L.penetrationWarn) {
    score -= 1
    issues.push(`Ayak zemine biraz giriyor (${Math.round(m.penetration * 100)} cm)`)
  }
  if (m.jitter > L.jitterFail || m.pop > L.popFail) {
    score -= 4
    issues.push(m.pop > L.popFail ? `Bir karede ${Math.round(m.pop * 100)} cm ani sıçrama var (kopuk geçiş)` : `Hareket titrek (${m.jitter} m/sn³)`)
    fixes.push('smooth, continuous motion')
  } else if (m.jitter > L.jitterWarn) {
    score -= 1
    issues.push(`Hafif titreme (${m.jitter} m/sn³)`)
  }
  if (targets.stationary && m.contactRatio < 0.5) {
    score -= 2
    issues.push('Yerinde durması gereken hareket ayaklarını çok kaldırıyor')
    fixes.push('stays in place with both feet on the ground')
  }

  if (targets.speed !== undefined && targets.measuredSpeed !== undefined) {
    const want = targets.speed
    const got = targets.measuredSpeed
    technical.push(`Hız: hedef ${want} m/sn, ölçülen ${got} m/sn`)
    const tol = Math.max(0.15, want * L.speedTolerance)
    if (Math.abs(got - want) > tol) {
      score -= 2
      issues.push(`Hız hedeften uzak (${got} m/sn, hedef ${want})`)
      fixes.push(got < want ? 'moves noticeably faster' : 'moves noticeably slower')
    }
  }
  if (targets.direction !== undefined && targets.measuredDirection !== undefined && (targets.measuredSpeed ?? 1) > 0.2) {
    const d = angleDiff(targets.measuredDirection, targets.direction)
    technical.push(`Yön: hedef ${targets.direction}°, ölçülen ${targets.measuredDirection}°`)
    if (d > L.angleTolerance) {
      score -= 2
      issues.push(`Hareket yönü ${Math.round(d)}° sapıyor`)
    }
  }
  if (targets.turn !== undefined && targets.measuredTurn !== undefined) {
    const d = Math.abs(targets.measuredTurn - targets.turn)
    technical.push(`Dönüş: hedef ${targets.turn}°, ölçülen ${targets.measuredTurn}°`)
    if (d > Math.max(L.angleTolerance, Math.abs(targets.turn) * 0.35)) {
      score -= 2
      issues.push(`Dönüş açısı hedeften ${Math.round(d)}° farklı`)
      fixes.push(targets.turn === 0 ? 'keeps facing forward without turning' : `turns ${Math.abs(targets.turn)} degrees to the ${targets.turn > 0 ? 'right' : 'left'}`)
    }
  }
  if (targets.loopCost !== undefined) {
    technical.push(`Döngü dikişi: ${targets.loopCost}`)
    if (targets.loopCost > L.loopCostWarn) {
      score -= 1
      issues.push('Döngü başı ve sonu arasında fark var; dikişte küçük atlama olabilir')
      fixes.push('a steady, repeating cycle')
    }
  }

  score = Math.max(0, Math.min(10, score))
  return { metrics: m, score, pass: score >= minScore, issues, promptFix: [...new Set(fixes)].join(', '), technical }
}
