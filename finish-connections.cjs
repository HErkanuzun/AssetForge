const fs=require('fs')
function edit(n,fn){const f=`src/renderer/src/components/${n}.tsx`;fs.writeFileSync(f,fn(fs.readFileSync(f,'utf8')))}
edit('ConnectionsSettings',s=>"import {panelLabel} from '../../../shared/i18n/display'\n"+s.replaceAll('const {t} = useLocale()','const {t, locale} = useLocale()').replace('{x.label}','{panelLabel(locale,x.label)}').replace('{m.label}','{panelLabel(locale,m.label)}').replace('toast(`Bağlantı tamam — ${await window.forge.llm.test(id)}`,',"toast(t('mcp.connected', {detail:await window.forge.llm.test(id)}),").replace('`çalışıyor · ${url}`',"t('backend.running', {url})").replace('{st.tools.length} araç',"{t('mcp.tools', {count:st.tools.length})}").replace('`${x.name}: ${r.tools.length} araç — ${r.tools.slice(0, 6).join(\', \')}`',"t('mcp.testResult', {name:x.name,count:r.tools.length,list:r.tools.slice(0,6).join(', ')})").replace("function copy(text: string, toast: (t: string, k?: 'ok') => void)","function copy(text: string, toast: (t: string, k?: 'ok') => void, message: string)").replace("toast('Kopyalandı',",'toast(message,').replace('copy(ccCmd, toast)',"copy(ccCmd, toast, panelLabel(locale,'Kopyalandı'))").replace('copy(desktop, toast)',"copy(desktop, toast, panelLabel(locale,'Kopyalandı'))"))
edit('WebSettings',s=>{
 s="import {lastSeen,timeLeft} from '../../../shared/i18n/display'\n"+s
 s=s.replace(/const ROLE: Record<WebRole, string>[\s\S]*?function Card/,'function Card')
 s=s.replace('const {t} = useLocale()',"const {t, locale} = useLocale()\n  const ROLE = { owner:t('role.owner'),editor:t('role.editor'),viewer:t('role.viewer') }\n  const ROLE_HELP = {owner:t('web.roleHelp.owner'),editor:t('web.roleHelp.editor'),viewer:t('web.roleHelp.viewer')}")
 s=s.replace('`Açık · ${st.online.length} bağlı`',"t('web.online', {count:st.online.length})")
 s=s.replace('{i.uses}/{i.maxUses} kullanıldı · {left(i.expiresAt)} kaldı',"{t('web.inviteUsage', {used:i.uses,max:i.maxUses,time:timeLeft(locale,i.expiresAt)})}")
 s=s.replace("son görülme: {onlineNames.has(u.name) ? t('panel.b9e76c5aa9') : ago(u.lastSeen)}","{t('web.lastSeen', {time:lastSeen(locale,onlineNames.has(u.name)?Date.now():u.lastSeen)})}")
 s=s.replace(/son görülme: \{onlineNames.has\(u.name\) \? t\('[^']+'\) : ago\(u.lastSeen\)\}/,"{t('web.lastSeen', {time:lastSeen(locale,onlineNames.has(u.name)?Date.now():u.lastSeen)})}")
 s=s.replace('`${u.name} kaldırılsın mı?`',"t('web.removeConfirm', {name:u.name})").replace('`${u.name} kaldırıldı`',"t('web.removed', {name:u.name})").replace('http://bilgisayar-adı:', 'http://computer-name:')
 return s
})
