import { panelLabel } from '../../../shared/i18n/display'
import { useLocale } from '../i18n'
// SPDX-License-Identifier: AGPL-3.0-only
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
  const {t, locale} = useLocale()

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
    [setSettings, toast]
  )

  const connected = (id: ConnectService) => (id === 'openrouter' ? s.llmProviders.some((p) => p.baseUrl.includes('openrouter.ai') && p.hasKey) : s.hasKeys[id])

  const start = async (id: ConnectService) => {
    setEv({ service: id, phase: 'waiting', message: t('panel.609eee0365') })
    try {
      await window.forge.connect.start(id)
    } catch (e) {
      setEv({ service: id, phase: 'error', message: (e as Error).message })
    }
  }

  const busy = ev && (ev.phase === 'waiting' || ev.phase === 'checking' || ev.pending) ? ev.service : null

  return (
    <section className="card">
      <h2> {t('panel.740f9ca963')} </h2>
      <p className="muted small"> {t('panel.17b5259b01')} </p>
      <div className="qc-grid">
        {TILES.map((tile) => {
          const on = connected(tile.id)
          const mine = ev?.service === tile.id ? ev : null
          const active = busy === tile.id
          return (
            <div key={tile.id} className={`qc-tile ${on ? 'on' : ''} ${active ? 'active' : ''}`}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b>{tile.name}</b>
                <span className={`chip ${on ? 'ok' : ''}`}>{on ? t('panel.0f6301b812') : t('panel.27f6e56345')}</span>
              </div>
              <div className="muted small">{panelLabel(locale, tile.what)}</div>
              <div className="dim small">{panelLabel(locale, tile.steps)}</div>
              {mine && mine.phase !== 'done' && mine.phase !== 'canceled' && (
                <div className={`qc-status small ${mine.phase === 'error' ? 'err' : ''}`}>
                  {active && <span className="spinner" />} {mine.message}
                </div>
              )}
              <div className="row" style={{ marginTop: 'auto' }}>
                {active ? (
                  <>
                    <button
                      className="btn"
                      disabled={mine?.phase === 'checking'}
                      title={t('panel.dcb935e308')}
                      onClick={() => window.forge.connect.tryClipboard()}
                    > {t('panel.ab1ca629df')} </button>
                    <button className="btn ghost" onClick={() => window.forge.connect.cancel()}> {t('surface.cancel')} </button>
                  </>
                ) : (
                  <button className={`btn ${on ? '' : 'primary'}`} disabled={!!busy} onClick={() => start(tile.id)}>
                    {on ? t('connect.reconnect') : tile.id === 'openrouter' ? t('connect.signIn') : t('panel.08901b80c4')}
                  </button>
                )}
                {tile.extra && (
                  <a className="small" href={tile.extra.url} target="_blank" rel="noreferrer">
                    {panelLabel(locale, tile.extra.label)}
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
