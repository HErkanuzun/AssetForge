import {lastSeen,timeLeft} from '../../../shared/i18n/display'
import { useLocale } from '../i18n'
// SPDX-License-Identifier: AGPL-3.0-only
// Ayarlar → Web ve paylaşım: tarayıcıdan aynı arayüz, sahip hesabı, davet bağlantıları, kişiler ve roller
import { useCallback, useEffect, useState } from 'react'
import type { WebRole, WebStatus } from '../../../shared/types'
import { useStore } from '../store'
import { AsyncButton, Field, Select, TextInput, Toggle } from './ui'
import { Icon } from './icons'

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {desc && <p className="muted small">{desc}</p>}
      {children}
    </section>
  )
}

export default function WebSettings() {
  const {t, locale} = useLocale()
  const ROLE = { owner:t('role.owner'),editor:t('role.editor'),viewer:t('role.viewer') }
  const ROLE_HELP = {owner:t('web.roleHelp.owner'),editor:t('web.roleHelp.editor'),viewer:t('web.roleHelp.viewer')}

  const { settings, setSettings, toast } = useStore()
  const s = settings!
  const cfg = s.web
  const [st, setSt] = useState<WebStatus | null>(null)
  const [port, setPort] = useState(String(cfg.port))
  const [owner, setOwner] = useState({ name: '', password: '' })
  const [inv, setInv] = useState<{ role: WebRole; hours: string; uses: string }>({ role: 'editor', hours: '72', uses: '1' })
  const [lastLink, setLastLink] = useState('')

  const refresh = useCallback(() => window.forge.web.status().then(setSt, () => undefined), [])
  useEffect(() => {
    refresh()
    const t = window.setInterval(refresh, 4000)
    return () => window.clearInterval(t)
  }, [refresh])

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn()
      if (ok) toast(ok, 'ok')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
    await refresh()
  }
  const patchWeb = (p: Partial<typeof cfg>) => run(async () => setSettings(await window.forge.settings.set({ web: { ...cfg, ...p } })))
  const copy = (text: string) =>
    navigator.clipboard.writeText(text).then(
      () => toast('Panoya kopyalandı', 'ok'),
      () => toast(text, 'info')
    )

  const users = st?.users ?? []
  const onlineNames = new Set((st?.online ?? []).map((o) => o.name))
  const portNum = Number(port)
  const portOk = Number.isInteger(portNum) && portNum >= 1024 && portNum <= 65535

  return (
    <>
      <Card
        title={t('panel.b35744103f')}
        desc={t('panel.990581ffe0')}
      >
        <div className="row" style={{ flexWrap: 'wrap', gap: 18 }}>
          <Toggle value={cfg.enabled} onChange={(v) => patchWeb({ enabled: v })} label={t('panel.8583da6400')} />
          <Toggle value={cfg.lan} onChange={(v) => patchWeb({ lan: v })} label={t('panel.2a603a335d')} />
          <Toggle value={cfg.headless} onChange={(v) => patchWeb({ headless: v })} label={t('panel.4337798e64')} />
        </div>
        <div className="grid2" style={{ marginTop: 12 }}>
          <Field label={t('panel.72e9a59f5a')} help={t('panel.9b35f4d869')}>
            <div className="row">
              <TextInput value={port} onChange={setPort} />
              <AsyncButton disabled={!portOk || portNum === cfg.port} onClick={() => patchWeb({ port: portNum })}> {t('panel.08a24723d5')} </AsyncButton>
            </div>
          </Field>
          <Field label={t('surface.status')}>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <span className={`web-led ${st?.running ? 'on' : st?.error ? 'err' : ''}`} />
              <span className="small">{st?.running ? t('web.online', {count:st.online.length}) : st?.error ? st.error : t('panel.39ce8f3878')}</span>
            </div>
          </Field>
        </div>
        {st?.running && (
          <div className="set-note" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
            {st.urls.map((u, i) => (
              <div key={u} className="row">
                <Icon name="link" size={14} />
                <b className="ellipsis">{u}</b>
                <span className="muted small">{i === 0 ? t('panel.51b0a3ddce') : t('panel.48c9b994b4')}</span>
                <span className="spacer" />
                <button className="btn" onClick={() => copy(u)}> {t('panel.a8bcca42d9')} </button>
              </div>
            ))}
            {!cfg.lan && <span className="dim small"> {t('panel.0b7c714d91')} </span>}
          </div>
        )}
        {cfg.enabled && !st?.ownerSet && (
          <div className="set-note">
            <Icon name="x" size={15} />
            <span> {t('panel.ec962927fa')} </span>
          </div>
        )}
        {!window.forge.isWeb && (
          <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
            <AsyncButton
              disabled={!st?.running}
              title={t('panel.d789b07f5e')}
              onClick={() => run(() => window.forge.web.headless())}
            > {t('panel.3cb14d8b6f')} </AsyncButton>
            <span className="dim small"> {t('panel.4197eafbad')} </span>
          </div>
        )}
      </Card>

      <Card title={t('panel.33485f74d8')} desc={t('panel.b423d54552')}>
        <div className="grid2">
          <Field label={t('surface.name')}>
            <TextInput value={owner.name} onChange={(v) => setOwner({ ...owner, name: v })} placeholder={users.find((u) => u.role === 'owner')?.name ?? 'ör. Deniz'} />
          </Field>
          <Field label={t('panel.e3962ceb93')} help={t('panel.a853252458')}>
            <TextInput type="password" value={owner.password} onChange={(v) => setOwner({ ...owner, password: v })} />
          </Field>
        </div>
        <AsyncButton
          className="primary"
          disabled={owner.name.trim().length < 2 || owner.password.length < 8}
          onClick={() =>
            run(
              async () => {
                await window.forge.web.setOwner(owner.name, owner.password)
                setOwner({ name: '', password: '' })
              },
              st?.ownerSet ? t('panel.e257ea5b74') : t('panel.7366580f62')
            )
          }
        >
          {st?.ownerSet ? t('panel.bf6531d30a') : t('panel.89c75b03b9')}
        </AsyncButton>
      </Card>

      <Card title={t('panel.e4c0dfec04')} desc={t('panel.384242ca51')}>
        <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label={t('panel.fb9f51fe92')} help={ROLE_HELP[inv.role]} wide>
            <Select
              value={inv.role}
              onChange={(v) => setInv({ ...inv, role: v as WebRole })}
              options={[
                { value: 'editor', label: t('panel.950cc4a742') },
                { value: 'viewer', label: t('panel.45efaf3a81') }
              ]}
            />
          </Field>
        </div>
        <div className="grid2">
          <Field label={t('panel.0f2540d5f3')}>
            <Select
              value={inv.hours}
              onChange={(v) => setInv({ ...inv, hours: v })}
              options={[
                { value: '1', label: t('panel.384a906712') },
                { value: '24', label: t('panel.b90bcde7b2') },
                { value: '72', label: t('panel.28511bc326') },
                { value: '168', label: t('panel.ebfa7fc06a') }
              ]}
            />
          </Field>
          <Field label={t('panel.02a418f115')}>
            <Select
              value={inv.uses}
              onChange={(v) => setInv({ ...inv, uses: v })}
              options={[
                { value: '1', label: t('panel.463276e127') },
                { value: '5', label: t('panel.6827d2bde5') },
                { value: '20', label: t('panel.b66a2719c7') }
              ]}
            />
          </Field>
        </div>
        <AsyncButton
          className="primary"
          disabled={!st?.running}
          title={st?.running ? undefined : t('panel.e157651b7f')}
          onClick={() =>
            run(async () => {
              const link = await window.forge.web.invite(inv.role, Number(inv.hours), Number(inv.uses))
              setLastLink(link)
              await navigator.clipboard.writeText(link).catch(() => undefined)
            }, t('panel.7c03117929'))
          }
        > {t('panel.96bc426fd7')} </AsyncButton>
        {lastLink && (
          <div className="set-note ok" style={{ marginTop: 10 }}>
            <Icon name="check" size={15} />
            <b className="ellipsis" style={{ flex: 1 }}>
              {lastLink}
            </b>
            <button className="btn" onClick={() => copy(lastLink)}> {t('panel.a8bcca42d9')} </button>
          </div>
        )}
        {!!st?.invites.length && (
          <div style={{ marginTop: 12 }}>
            {st.invites.map((i) => (
              <div key={i.token} className="mcp-row row">
                <span className="chip">{ROLE[i.role]}</span>
                <span className="small muted">
                  {t('web.inviteUsage', {used:i.uses,max:i.maxUses,time:timeLeft(locale,i.expiresAt)})}
                </span>
                <span className="spacer" />
                <button className="btn" onClick={() => copy(i.url)}> {t('panel.a2bb5f86fa')} </button>
                <button className="btn ghost" onClick={() => run(() => window.forge.web.revokeInvite(i.token), t('panel.d68eeec498'))}> {t('surface.cancel')} </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={t('panel.9ec02b00cc')} desc={t('panel.c980168c12')}>
        {!users.length && <p className="dim small"> {t('panel.f152953309')} </p>}
        {users.map((u) => (
          <div key={u.id} className="mcp-row row">
            <span className={`web-led ${onlineNames.has(u.name) ? 'on' : ''}`} title={onlineNames.has(u.name) ? t('panel.96c969056a') : t('panel.a6204fb9ae')} />
            <b>{u.name}</b>
            <span className="small muted">{t('web.lastSeen', {time:lastSeen(locale,onlineNames.has(u.name)?Date.now():u.lastSeen)})}</span>
            <span className="spacer" />
            {u.role === 'owner' ? (
              <span className="chip ok"> {t('panel.4661915f75')} </span>
            ) : (
              <>
                <select
                  className="input"
                  style={{ width: 150 }}
                  value={u.role}
                  onChange={(e) => run(() => window.forge.web.setRole(u.id, e.target.value as WebRole), `${u.name}: ${ROLE[e.target.value as WebRole]}`)}
                >
                  <option value="editor"> {t('panel.e3948c8c82')} </option>
                  <option value="viewer"> {t('panel.ec9c1cfbf8')} </option>
                </select>
                <button className="btn ghost" title={t('panel.065c074ce3')} onClick={() => confirm(t('web.removeConfirm', {name:u.name})) && run(() => window.forge.web.removeUser(u.id), t('web.removed', {name:u.name}))}>
                  <Icon name="trash" size={13} />
                </button>
              </>
            )}
          </div>
        ))}
      </Card>

      <Card title={t('panel.2e0cef85fb')}>
        <ol className="set-steps small">
          <li>
            <b> {t('panel.b916659b94')} </b> {t('panel.88bdecdabc')} </li>
          <li>
            <b> {t('panel.2e376bb0b4')} </b> {t('panel.f758b8a9f1')} <code>http://computer-name:{cfg.port}</code> {t('panel.503999d609')} </li>
          <li>
            <b>Cloudflare Tunnel:</b> <code>cloudflared tunnel --url http://127.0.0.1:{cfg.port}</code> {t('panel.b67804e196')} </li>
        </ol>
        <p className="dim small"> {t('panel.195981fd2f')} </p>
      </Card>
    </>
  )
}
