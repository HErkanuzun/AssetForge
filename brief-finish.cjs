const fs=require('fs'),f='src/renderer/src/pages/BriefPage.tsx';let s=fs.readFileSync(f,'utf8')
const pairs=[
 ["'Yalnızca görsel dosyaları veya kütüphane asset’leri bırakılabilir'","t('brief.dropOnly')"],
 ["'Görsel eklenemedi: ' + err.message","t('brief.imageFailed', {detail:err.message})"],
 ["name: 'Görseller'","name: t('brief.images')"],
 ["'Üretilecek bir şey yok — kitten en az bir parça seç'","t('brief.noProduction')"],
 ['`🔥 ${assets.length} asset üretime girdi${waiting ? ` (${waiting} animasyon karakteri bekliyor)` : \'\'}`',"t('brief.productionStarted', {count:assets.length,waiting})"],
 ['>Yükleniyor…<',">{t('app.loading')}<"],['title="Atölye"',"title={t('app.workshop')}"],
 ['Yönetmenle tasarım konuşması · {brief.view.filter((v) => v.kind === \'question\').length} soru',"{t('brief.questions', {count:brief.view.filter((v) => v.kind === 'question').length})}"],
 ['>Ne düşünüyorsun?<',">{t('brief.ideaTitle')}<"],['>Fikrini yaz, referans görsel ya da kütüphaneden bir asset sürükle.<',">{t('brief.ideaHelp')}<"],
 ['Seçimleri gönder ({multi.length})',"{t('brief.sendChoices', {count:multi.length})}"],['>ya da aşağıya kendi cevabını yaz<',">{t('brief.ownAnswer')}<"],
 ["thinking ? 'Yönetmen düşünüyor…' : 'Yönetmen yazıyor…'","thinking ? t('brief.thinking') : t('brief.writing')"],
 ['{g.label}',"{t(({model:'brief.models',doku:'brief.textures',ses:'brief.sounds',vfx:'brief.effects',animasyon:'brief.animations'} as const)[g.id])}"],
 ['dinamik · {k.dynamic.layers} katman · {k.dynamic.idleRpm}–{k.dynamic.maxRpm} RPM',"{t('surface.layers', {count:k.dynamic.layers,idle:k.dynamic.idleRpm,max:k.dynamic.maxRpm})}"],
 ['{k.motion.seconds} sn',"{k.motion.seconds} {t('surface.secondsShort')}"],['`· ${included.length + 1} asset`',"`· ${included.length + 1} ${t('app.assets')}`"]
];for(const [a,b] of pairs){if(!s.includes(a)) console.log('miss',a);s=s.replaceAll(a,b)}fs.writeFileSync(f,s)
