import { useLocale } from '../i18n'
// SPDX-License-Identifier: AGPL-3.0-only
// Ayarlar → Yapay zeka modelleri: aboneliğinle çalışan ajan CLI'ları (Claude Code, Codex) kurulu mu?
// Tarama yalnızca düğmeyle ya da bu kart ilk açıldığında bir kez yapılır; sonuç oturum boyunca saklanır.
import { useEffect, useState } from 'react'
import type { AgentCliInfo } from '../../../shared/types'
import { Icon } from './icons'

export default function AgentClis() {
  const {t} = useLocale()

  const [list, setList] = useState<AgentCliInfo[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const scan = async (force: boolean) => {
    setBusy(true)
    setError('')
    try {
      setList(await window.forge.agent.clis(force))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    void scan(false)
  }, [])

  return (
    <section className="card">
      <h2> {t('panel.0fbc3f3682')} </h2>
      <p className="muted small"> {t('panel.00296035cc')} </p>
      {error && <div className="set-note warn">{error}</div>}
      {list?.map((c) => (
        <div key={c.id} className={`set-note ${c.installed && !c.error ? 'ok' : ''}`}>
          <Icon name={c.installed && !c.error ? 'check' : 'link'} size={15} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <b>{c.name}</b> — {c.installed ? (c.version ?? c.error) : t('panel.3b827a806d')}
            {c.path && (
              <span className="dim small ellipsis" style={{ display: 'block' }}>
                {c.path}
              </span>
            )}
          </span>
          {!c.installed && (
            <a className="small" href={c.install} target="_blank" rel="noreferrer"> {t('panel.f3e5a7f25e')} </a>
          )}
        </div>
      ))}
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn" disabled={busy} onClick={() => scan(true)}>
          {busy ? <span className="spinner" /> : <Icon name="refresh" size={13} />} {t('panel.9ac0650a83')} </button>
      </div>
    </section>
  )
}
