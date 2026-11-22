const fs=require('fs')
function edit(name,pairs){let f=`src/renderer/src/components/${name}.tsx`,s=fs.readFileSync(f,'utf8');for(const[a,b]of pairs){if(!s.includes(a))console.log('miss',name,a);s=s.replaceAll(a,b)}fs.writeFileSync(f,s)}
edit('QuickConnect',[["'Yeniden bağla'","t('connect.reconnect')"],["'Giriş yap ve bağlan'","t('connect.signIn')"]])
edit('ComfyLibrary',[
 ['`kapalı${',"`${t('comfy.off')}${"],['`çalıştırabilir${',"`${t('comfy.canRun')}${"],['` · kuyruk ${f.queue}`',"t('comfy.queue', {count:f.queue})"],['`eksik düğüm: ${f.missingNodes.join(\', \')}`',"t('comfy.missingNodes', {list:f.missingNodes.join(', ')})"],['`eksik model: ${f.missingModels.join(\', \')}`',"t('comfy.missingModels', {list:f.missingModels.join(', ')})"],
 ['`Eklendi: ${added.map((w) => w.name).join(\', \')}`',"t('comfy.added', {name:added.map(w=>w.name).join(', ')})"],['`Eklendi: ${w.name}`',"t('comfy.added', {name:w.name})"],['`${w.name} güncellendi`',"t('comfy.updated', {name:w.name})"],
 ['placeholder=\'ComfyUI → Workflow → Export (API) çıktısı: {"3": {"class_type": "KSampler", …}}\'',"placeholder={t('comfy.jsonPlaceholder')}"],
 ])
edit('ComfyServers',[["st?.error ?? 'Kapalı'","st?.error ?? t('comfy.off')"],['`${x.name} (kapalı)`',"t('comfy.disabledName', {name:x.name})"]])
edit('CustomBackends',[
 ["const ROLE_LABEL: Record<string, string> = { prompt: 'prompt', negative: 'negatif', seed: 'seed', seconds: 'süre', image: 'görsel', model: '3D model', audio: 'ses', file: 'dosya' }", "const ROLE_LABEL = {prompt:'backend.role.prompt',negative:'backend.role.negative',seed:'backend.role.seed',seconds:'backend.role.seconds',image:'backend.role.image',model:'backend.role.model',audio:'backend.role.audio',file:'backend.role.file'} as const"],
 ['ROLE_LABEL[p.role] ?? p.role',"p.role in ROLE_LABEL ? t(ROLE_LABEL[p.role as keyof typeof ROLE_LABEL]) : p.role"], ["|| 'giriş yok'","|| t('backend.noInputs')"],["'depo yok'","t('backend.noRepo')"],['`çalışıyor · ${st.url}`',"t('backend.running', {url:st.url ?? ''})"],["'Tarif kaydedildi'","t('backend.saved')"],['`${b.name} hazır`',"t('backend.ready', {name:b.name})"],['`${b.name} kaldırıldı`',"t('backend.removed', {name:b.name})"],['`${r.backend.name} indirildi; tarifi gözden geçirip “Kur”a basın`',"t('backend.downloaded', {name:r.backend.name})"],["'Yeniden kur'","t('backend.reinstall')"],["'Kur'","t('backend.install')"],['`başlatma: ${b.recipe.start}`',"t('backend.startCommand', {command:b.recipe.start})"]
])
