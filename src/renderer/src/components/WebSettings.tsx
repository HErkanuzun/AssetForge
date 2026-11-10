// SPDX-License-Identifier: AGPL-3.0-only
// Ayarlar → Web ve paylaşım: tarayıcıdan aynı arayüz, sahip hesabı, davet bağlantıları, kişiler ve roller
import { useCallback, useEffect, useState } from 'react'
import type { WebRole, WebStatus } from '../../../shared/types'
import { useStore } from '../store'
import { AsyncButton, Field, Select, TextInput, Toggle } from './ui'
import { Icon } from './icons'

const ROLE: Record<WebRole, string> = { owner: 'Sahip', editor: 'Editör', viewer: 'İzleyici' }
const ROLE_HELP: Record<WebRole, string> = {
  owner: 'Her şey, Ayarlar dahil',
  editor: 'Asset, hat, brief, tasarım düzenler ve üretim başlatır. Ayarlar, anahtarlar, kurulumlar ve Unreal Python’a dokunamaz.',
  viewer: 'Yalnızca görüntüler'
}

const ago = (t?: number) => {
  if (!t) return 'hiç'
  const m = Math.round((Date.now() - t) / 60_000)
  if (m < 1) return 'şimdi'
  if (m < 60) return `${m} dk önce`
  const h = Math.round(m / 60)
  return h < 48 ? `${h} sa önce` : `${Math.round(h / 24)} gün önce`
}
const left = (t: number) => {
  const h = Math.max(0, Math.round((t - Date.now()) / 3600_000))
  return h < 48 ? `${h} sa` : `${Math.round(h / 24)} gün`
}

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
        title="Web sunucusu"
        desc="AssetForge’u tarayıcıdan da açın: aynı proje, aynı işler, aynı arayüz. Ekip arkadaşlarınız davet bağlantısıyla katılır; herkesin yaptığı değişiklik diğerlerine anında yansır. Üretim bu bilgisayarda ve bu bilgisayarın anahtarlarıyla yapılır."
      >
        <div className="row" style={{ flexWrap: 'wrap', gap: 18 }}>
          <Toggle value={cfg.enabled} onChange={(v) => patchWeb({ enabled: v })} label="Sunucu açık" />
          <Toggle value={cfg.lan} onChange={(v) => patchWeb({ lan: v })} label="Yerel ağa aç (diğer bilgisayarlar)" />
          <Toggle value={cfg.headless} onChange={(v) => patchWeb({ headless: v })} label="Açılışta pencere açılmasın (yalnızca sunucu)" />
        </div>
        <div className="grid2" style={{ marginTop: 12 }}>
          <Field label="Port" help="1024–65535. Değiştirince sunucu yeniden başlar.">
            <div className="row">
              <TextInput value={port} onChange={setPort} />
              <AsyncButton disabled={!portOk || portNum === cfg.port} onClick={() => patchWeb({ port: portNum })}>
                Uygula
              </AsyncButton>
            </div>
          </Field>
          <Field label="Durum">
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <span className={`web-led ${st?.running ? 'on' : st?.error ? 'err' : ''}`} />
              <span className="small">{st?.running ? `Açık · ${st.online.length} bağlı` : st?.error ? st.error : 'Kapalı'}</span>
            </div>
          </Field>
        </div>
        {st?.running && (
          <div className="set-note" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
            {st.urls.map((u, i) => (
              <div key={u} className="row">
                <Icon name="link" size={14} />
                <b className="ellipsis">{u}</b>
                <span className="muted small">{i === 0 ? 'bu bilgisayar' : 'yerel ağ'}</span>
                <span className="spacer" />
                <button className="btn" onClick={() => copy(u)}>
                  Kopyala
                </button>
              </div>
            ))}
            {!cfg.lan && <span className="dim small">Yalnızca bu bilgisayardan açılır. Başkaları katılacaksa “Yerel ağa aç”ı açın ya da aşağıdaki tünel yollarından birini kullanın.</span>}
          </div>
        )}
        {cfg.enabled && !st?.ownerSet && (
          <div className="set-note">
            <Icon name="x" size={15} />
            <span>Tarayıcıdan girebilmek için önce aşağıdan sahip hesabını oluşturun.</span>
          </div>
        )}
        {!window.forge.isWeb && (
          <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
            <AsyncButton
              disabled={!st?.running}
              title="Pencere kapanır; sunucu bildirim alanında (saatin yanında) çalışmaya devam eder. Simgeye tıklayınca pencere geri gelir."
              onClick={() => run(() => window.forge.web.headless())}
            >
              Pencereyi kapat, sunucu çalışsın
            </AsyncButton>
            <span className="dim small">Komut satırından: AssetForge.exe --headless</span>
          </div>
        )}
      </Card>

      <Card title="Sahip hesabı" desc="Tarayıcıdan sizin girişiniz. Sahip her şeyi yapabilir (Ayarlar dahil). Parolayı değiştirmek eski oturumları kapatır.">
        <div className="grid2">
          <Field label="Ad">
            <TextInput value={owner.name} onChange={(v) => setOwner({ ...owner, name: v })} placeholder={users.find((u) => u.role === 'owner')?.name ?? 'ör. Deniz'} />
          </Field>
          <Field label="Parola" help="En az 8 karakter">
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
              st?.ownerSet ? 'Sahip hesabı güncellendi' : 'Sahip hesabı oluşturuldu'
            )
          }
        >
          {st?.ownerSet ? 'Güncelle' : 'Oluştur'}
        </AsyncButton>
      </Card>

      <Card title="Davet bağlantıları" desc="Bağlantıyı açan kişi kendi adını ve parolasını seçip katılır. Bağlantıyı yalnızca güvendiğiniz kişilerle paylaşın.">
        <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="Rol" help={ROLE_HELP[inv.role]} wide>
            <Select
              value={inv.role}
              onChange={(v) => setInv({ ...inv, role: v as WebRole })}
              options={[
                { value: 'editor', label: 'Editör — üretir ve düzenler' },
                { value: 'viewer', label: 'İzleyici — yalnızca bakar' }
              ]}
            />
          </Field>
        </div>
        <div className="grid2">
          <Field label="Geçerlilik">
            <Select
              value={inv.hours}
              onChange={(v) => setInv({ ...inv, hours: v })}
              options={[
                { value: '1', label: '1 saat' },
                { value: '24', label: '1 gün' },
                { value: '72', label: '3 gün' },
                { value: '168', label: '1 hafta' }
              ]}
            />
          </Field>
          <Field label="Kaç kişi kullanabilir">
            <Select
              value={inv.uses}
              onChange={(v) => setInv({ ...inv, uses: v })}
              options={[
                { value: '1', label: '1 kişi' },
                { value: '5', label: '5 kişi' },
                { value: '20', label: '20 kişi' }
              ]}
            />
          </Field>
        </div>
        <AsyncButton
          className="primary"
          disabled={!st?.running}
          title={st?.running ? undefined : 'Önce sunucuyu açın'}
          onClick={() =>
            run(async () => {
              const link = await window.forge.web.invite(inv.role, Number(inv.hours), Number(inv.uses))
              setLastLink(link)
              await navigator.clipboard.writeText(link).catch(() => undefined)
            }, 'Davet bağlantısı oluşturuldu ve kopyalandı')
          }
        >
          Davet oluştur
        </AsyncButton>
        {lastLink && (
          <div className="set-note ok" style={{ marginTop: 10 }}>
            <Icon name="check" size={15} />
            <b className="ellipsis" style={{ flex: 1 }}>
              {lastLink}
            </b>
            <button className="btn" onClick={() => copy(lastLink)}>
              Kopyala
            </button>
          </div>
        )}
        {!!st?.invites.length && (
          <div style={{ marginTop: 12 }}>
            {st.invites.map((i) => (
              <div key={i.token} className="mcp-row row">
                <span className="chip">{ROLE[i.role]}</span>
                <span className="small muted">
                  {i.uses}/{i.maxUses} kullanıldı · {left(i.expiresAt)} kaldı
                </span>
                <span className="spacer" />
                <button className="btn" onClick={() => copy(i.url)}>
                  Bağlantıyı kopyala
                </button>
                <button className="btn ghost" onClick={() => run(() => window.forge.web.revokeInvite(i.token), 'Davet iptal edildi')}>
                  İptal
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Kişiler" desc="Rol değişince ya da kişi kaldırılınca açık bağlantısı kapanır; yeni rolle yeniden bağlanır.">
        {!users.length && <p className="dim small">Henüz hesap yok.</p>}
        {users.map((u) => (
          <div key={u.id} className="mcp-row row">
            <span className={`web-led ${onlineNames.has(u.name) ? 'on' : ''}`} title={onlineNames.has(u.name) ? 'Şu an bağlı' : 'Bağlı değil'} />
            <b>{u.name}</b>
            <span className="small muted">son görülme: {onlineNames.has(u.name) ? 'şimdi' : ago(u.lastSeen)}</span>
            <span className="spacer" />
            {u.role === 'owner' ? (
              <span className="chip ok">Sahip</span>
            ) : (
              <>
                <select
                  className="input"
                  style={{ width: 150 }}
                  value={u.role}
                  onChange={(e) => run(() => window.forge.web.setRole(u.id, e.target.value as WebRole), `${u.name}: ${ROLE[e.target.value as WebRole]}`)}
                >
                  <option value="editor">Editör</option>
                  <option value="viewer">İzleyici</option>
                </select>
                <button className="btn ghost" title="Hesabı kaldır" onClick={() => confirm(`${u.name} kaldırılsın mı?`) && run(() => window.forge.web.removeUser(u.id), `${u.name} kaldırıldı`)}>
                  <Icon name="trash" size={13} />
                </button>
              </>
            )}
          </div>
        ))}
      </Card>

      <Card title="İnternetten erişim ve güvenlik">
        <ol className="set-steps small">
          <li>
            <b>Aynı ağ (ofis, ev):</b> “Yerel ağa aç”ı açıp yukarıdaki ağ adresini paylaşın. Windows ilk seferde güvenlik duvarı izni sorar; “Özel ağlar”a izin verin.
          </li>
          <li>
            <b>Tailscale (önerilen):</b> herkes Tailscale’i kurup aynı ağa (tailnet) katılır; adres <code>http://bilgisayar-adı:{cfg.port}</code> olur. Trafik şifrelidir ve dışarıya açık port yoktur.
          </li>
          <li>
            <b>Cloudflare Tunnel:</b> <code>cloudflared tunnel --url http://127.0.0.1:{cfg.port}</code> komutu size bir https adresi verir. “Yerel ağa aç” kapalı kalabilir. Davet bağlantılarındaki
            adresi tünel adresiyle değiştirin.
          </li>
        </ol>
        <p className="dim small">
          Yerel ağda bağlantı şifresiz HTTP’dir; parolalar aynı ağdaki biri tarafından görülebilir. Güvenmediğiniz ağlarda Tailscale ya da tünel kullanın. Editörlerin başlattığı üretimler bu
          bilgisayardaki API anahtarlarıyla ve kredisiyle yapılır. Editörler proje klasörü dışındaki dosyaları okutamaz, Ayarlar’a ve Unreal Python’a erişemez.
        </p>
      </Card>
    </>
  )
}
