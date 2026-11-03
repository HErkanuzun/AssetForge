// Ayarlar → Hızlı bağlantı: tek tıkla servisin giriş/anahtar sayfasını açar, anahtar kendiliğinden kaydedilir
import { useEffect, useState } from 'react'
import type { ConnectEvent, ConnectService } from '../../../shared/types'
import { useStore } from '../store'

interface Tile {
  id: ConnectService
  name: string
  what: string
  steps: string
  extra?: { label: string; url: string }
}

const TILES: Tile[] = [
  { id: 'anthropic', name: 'Claude', what: 'Prompt motoru, brief sohbeti, kalite kontrol', steps: 'Giriş yap → “Create Key” → Kopyala' },
  { id: 'meshy', name: 'Meshy', what: '3D model, doku, rig', steps: 'Giriş yap → “Create API Key” → Kopyala' },
  { id: 'elevenlabs', name: 'ElevenLabs', what: 'Ses efektleri, motor sesi', steps: 'Giriş yap → “Create API key” → Kopyala' },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    what: 'Kimodo animasyon (Llama-3 lisansı gerekir)',
    steps: 'Giriş yap → “Create token” → Kopyala',
    extra: { label: 'Llama-3 lisansını kabul et ↗', url: 'https://huggingface.co/meta-llama/Meta-Llama-3-8B-Instruct' }
  },
  { id: 'openrouter', name: 'OpenRouter', what: 'Yüzlerce model tek hesapla (isteğe bağlı)', steps: 'Giriş yap → “Authorize” — anahtar gerekmez' }
]

export default function QuickConnect() {
  const { settings, setSettings, toast } = useStore()
  const s = settings!
  const [ev, setEv] = useState<ConnectEvent | null>(null)

  useEffect(
    () =>
      window.forge.connect.onEvent(async (e) => {
        setEv(e)
        if (e.phase === 'done') {
          setSettings(await window.forge.settings.get())
          toast(e.message, 'ok')
        }
      }),
    []
  )

  const connected = (id: ConnectService) =>
    id === 'openrouter' ? s.llmProviders.some((p) => p.baseUrl.includes('openrouter.ai') && p.hasKey) : s.hasKeys[id]

  const start = async (id: ConnectService) => {
    setEv({ service: id, phase: 'waiting', message: 'Tarayıcı açılıyor…' })
    try {
      await window.forge.connect.start(id)
    } catch (e) {
      setEv({ service: id, phase: 'error', message: (e as Error).message })
    }
  }

  const busy = ev && (ev.phase === 'waiting' || ev.phase === 'checking') ? ev.service : null

  return (
    <section className="card">
      <h2>Hızlı bağlantı</h2>
      <p className="muted small">
        “Bağlan”a basın: servisin sayfası tarayıcıda açılır. Giriş yapıp anahtarı kopyalamanız yeterli — AssetForge panodan yakalar, doğrular ve şifreli kaydeder. Elle yapıştırmak isterseniz
        aşağıdaki alanlar da duruyor.
      </p>
      <div className="qc-grid">
        {TILES.map((t) => {
          const on = connected(t.id)
          const mine = ev?.service === t.id ? ev : null
          const active = busy === t.id
          return (
            <div key={t.id} className={`qc-tile ${on ? 'on' : ''} ${active ? 'active' : ''}`}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b>{t.name}</b>
                <span className={`chip ${on ? 'ok' : ''}`}>{on ? '✓ bağlı' : 'bağlı değil'}</span>
              </div>
              <div className="muted small">{t.what}</div>
              <div className="dim small">{t.steps}</div>
              {mine && mine.phase !== 'done' && mine.phase !== 'canceled' && (
                <div className={`qc-status small ${mine.phase === 'error' ? 'err' : ''}`}>
                  {active && <span className="spinner" />} {mine.message}
                </div>
              )}
              <div className="row" style={{ marginTop: 'auto' }}>
                {active ? (
                  <button className="btn ghost" onClick={() => window.forge.connect.cancel()}>
                    İptal
                  </button>
                ) : (
                  <button className={`btn ${on ? '' : 'primary'}`} disabled={!!busy} onClick={() => start(t.id)}>
                    {on ? 'Yeniden bağla' : t.id === 'openrouter' ? 'Giriş yap ve bağlan' : 'Bağlan'}
                  </button>
                )}
                {t.extra && (
                  <a className="small" href={t.extra.url} target="_blank" rel="noreferrer">
                    {t.extra.label}
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
