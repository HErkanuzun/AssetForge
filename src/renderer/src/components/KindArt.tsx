// Asset türleri için büyük SVG illüstrasyonlar (karo kartları ve küçük resmi olmayan asset'ler)
import { useId } from 'react'
import type { AssetKind } from '../../../shared/types'

export const KIND_THEME: Record<AssetKind, { label: string; a: string; b: string; glow: string }> = {
  character: { label: 'Karakter', a: '#ff7a3d', b: '#7a1f4f', glow: '#ffb070' },
  vehicle: { label: 'Araç', a: '#3db8ff', b: '#1b2a7a', glow: '#8fdcff' },
  creature: { label: 'Yaratık', a: '#8bff6a', b: '#125244', glow: '#c6ffa8' },
  weapon: { label: 'Silah', a: '#ffd04d', b: '#6b3410', glow: '#ffe7a0' },
  model: { label: 'Prop / Yapı', a: '#c08bff', b: '#35186e', glow: '#e1c6ff' },
  texture: { label: 'Doku', a: '#e8b878', b: '#5a3517', glow: '#ffe1b0' },
  image: { label: 'Görsel', a: '#7ae0d0', b: '#13505a', glow: '#bff7ee' },
  sfx: { label: 'Ses', a: '#4dffb8', b: '#0f4d4a', glow: '#b8ffe4' },
  music: { label: 'Müzik', a: '#ff6ad5', b: '#4d136b', glow: '#ffc0ee' },
  vfx: { label: 'VFX', a: '#ff5a3c', b: '#3b0f2e', glow: '#ffc06a' },
  animation: { label: 'Animasyon', a: '#ff4f9a', b: '#2b1a6e', glow: '#ffb3d4' }
}

function Figure({ kind, g }: { kind: AssetKind; g: string }) {
  const fill = `url(#${g}-fig)`
  const line = 'rgba(255,255,255,.85)'
  switch (kind) {
    case 'character':
      return (
        <g>
          <ellipse cx="100" cy="212" rx="46" ry="7" fill="#000" opacity=".35" />
          <path
            d="M100 52c-14 0-23 10-23 24 0 9 4 15 9 19l-24 14c-8 5-11 13-11 22l-4 52h20l6-44 4 77h16l7-50 7 50h16l4-77 6 44h20l-4-52c0-9-3-17-11-22l-24-14c5-4 9-10 9-19 0-14-9-24-23-24z"
            fill={fill}
          />
          <path d="M78 74c4-16 40-18 45 0" stroke={line} strokeWidth="2.5" fill="none" />
          <rect x="120" y="104" width="22" height="40" rx="6" fill="#000" opacity=".25" />
        </g>
      )
    case 'vehicle':
      return (
        <g>
          <ellipse cx="100" cy="190" rx="86" ry="8" fill="#000" opacity=".35" />
          <path d="M22 160c0-14 6-22 18-24l20-4 22-26c4-5 10-8 17-8h40c8 0 14 4 18 10l14 22 14 4c8 2 13 9 13 18v10H22z" fill={fill} />
          <path d="M70 132l18-22h22v22zM118 110h18l12 22h-30z" fill="#0b0f22" opacity=".55" />
          <circle cx="58" cy="168" r="18" fill="#0a0c14" stroke={line} strokeWidth="3" />
          <circle cx="150" cy="168" r="18" fill="#0a0c14" stroke={line} strokeWidth="3" />
          <circle cx="58" cy="168" r="6" fill={line} />
          <circle cx="150" cy="168" r="6" fill={line} />
          <path d="M184 146l14-3v8z" fill="#fff" opacity=".9" />
        </g>
      )
    case 'creature':
      return (
        <g>
          <ellipse cx="100" cy="200" rx="80" ry="8" fill="#000" opacity=".35" />
          <path d="M34 150c4-26 26-44 58-44 22 0 36 6 50 16l18-14 10 6-8 18c8 10 10 18 10 28l-14 38h-14l4-30-18 6 2 26h-14l-6-30H70l-6 30H50l2-34c-10-4-18-10-18-16z" fill={fill} />
          <path d="M70 110l6-18 8 16M92 106l8-20 6 20M114 110l10-18 4 20" fill={fill} />
          <circle cx="160" cy="126" r="3.5" fill="#fff" />
          <path d="M150 146l20 2" stroke={line} strokeWidth="2.5" />
        </g>
      )
    case 'weapon':
      return (
        <g transform="rotate(-28 100 120)">
          <rect x="28" y="108" width="128" height="20" rx="4" fill={fill} />
          <rect x="150" y="112" width="34" height="10" rx="3" fill={fill} />
          <path d="M60 128l-6 46h22l10-46z" fill={fill} />
          <rect x="94" y="128" width="12" height="22" rx="3" fill="#000" opacity=".35" />
          <rect x="36" y="100" width="40" height="8" rx="3" fill={line} />
          <path d="M28 112h-14v12h14" fill={fill} />
        </g>
      )
    case 'texture':
      return (
        <g>
          {[0, 1, 2].map((r) =>
            [0, 1, 2].map((c) => (
              <path key={`${r}${c}`} d={`M${100 + (c - r) * 34} ${78 + (c + r) * 20}l34 20-34 20-34-20z`} fill={fill} opacity={0.55 + ((r + c) % 3) * 0.18} stroke="rgba(255,255,255,.35)" />
            ))
          )}
          <path d="M66 98c10 4 20-2 30 2s18 6 30 0" stroke={line} strokeWidth="2" fill="none" opacity=".6" />
        </g>
      )
    case 'sfx':
    case 'music':
      return (
        <g>
          {Array.from({ length: 15 }, (_, i) => {
            const h = 18 + Math.abs(Math.sin(i * 1.3)) * 70 + (i % 4) * 6
            return <rect key={i} x={30 + i * 10} y={124 - h / 2} width="6" height={h} rx="3" fill={fill} />
          })}
          <circle cx="100" cy="124" r="70" fill="none" stroke={line} strokeOpacity=".25" strokeWidth="2" />
          <circle cx="100" cy="124" r="88" fill="none" stroke={line} strokeOpacity=".12" strokeWidth="2" />
        </g>
      )
    case 'vfx':
      return (
        <g>
          <circle cx="86" cy="140" r="34" fill={fill} opacity=".9" />
          <circle cx="118" cy="122" r="28" fill={fill} opacity=".75" />
          <circle cx="104" cy="96" r="20" fill={fill} opacity=".6" />
          <circle cx="128" cy="78" r="12" fill={fill} opacity=".45" />
          {[
            [40, 90],
            [160, 150],
            [150, 60],
            [52, 180],
            [170, 104]
          ].map(([x, y], i) => (
            <path key={i} d={`M${x} ${y}l4 -10 4 10 10 4 -10 4 -4 10 -4 -10 -10 -4z`} fill="#fff" opacity=".85" />
          ))}
        </g>
      )
    case 'animation':
      return (
        <g>
          <path d="M28 120h40M20 140h34M32 160h26" stroke={line} strokeWidth="3" strokeLinecap="round" opacity=".5" />
          <g stroke={fill} strokeWidth="11" strokeLinecap="round" fill="none">
            <path d="M118 84l-10 46" />
            <path d="M110 92l-24 14 -10 22M114 94l26 8 14 -16" />
            <path d="M108 130l-26 26 -6 30M108 130l24 18 -4 34" />
          </g>
          <circle cx="124" cy="66" r="13" fill={fill} />
          {[
            [108, 130],
            [86, 106],
            [140, 102],
            [82, 156],
            [132, 148]
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="5" fill="#fff" />
          ))}
        </g>
      )
    case 'image':
      return (
        <g>
          <rect x="44" y="68" width="112" height="96" rx="8" fill={fill} />
          <path d="M52 150l30-34 22 24 16-14 28 24z" fill="#000" opacity=".35" />
          <circle cx="128" cy="96" r="10" fill="#fff" opacity=".85" />
        </g>
      )
    default:
      return (
        <g>
          <path d="M100 52l58 32v64l-58 32-58-32V84z" fill={fill} />
          <path d="M42 84l58 32 58-32M100 116v64" stroke="rgba(0,0,0,.35)" strokeWidth="3" fill="none" />
          <path d="M100 52l58 32-58 32-58-32z" fill="#fff" opacity=".18" />
        </g>
      )
  }
}

export default function KindArt({ kind, className, seed = 0 }: { kind: AssetKind; className?: string; seed?: number }) {
  const g = 'ka' + useId().replace(/[^a-z0-9]/gi, '')
  const t = KIND_THEME[kind] ?? KIND_THEME.model
  return (
    <svg className={className} viewBox="0 0 200 240" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={`${g}-bg`} cx="50%" cy={`${38 + (seed % 5) * 3}%`} r="75%">
          <stop offset="0" stopColor={t.a} stopOpacity=".55" />
          <stop offset=".55" stopColor={t.b} stopOpacity=".55" />
          <stop offset="1" stopColor="#07080c" />
        </radialGradient>
        <linearGradient id={`${g}-fig`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={t.glow} />
          <stop offset="1" stopColor={t.a} />
        </linearGradient>
        <pattern id={`${g}-grid`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="#fff" strokeOpacity=".05" />
        </pattern>
        <filter id={`${g}-glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="200" height="240" fill="#07080c" />
      <rect width="200" height="240" fill={`url(#${g}-bg)`} />
      <rect width="200" height="240" fill={`url(#${g}-grid)`} />
      <path d="M0 196 L200 196" stroke={t.glow} strokeOpacity=".25" />
      <g filter={`url(#${g}-glow)`}>
        <Figure kind={kind} g={g} />
      </g>
    </svg>
  )
}
