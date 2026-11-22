const fs=require('fs'),parser=require('@babel/parser')
const files=['store.tsx','App.tsx',...fs.readdirSync('src/renderer/src/pages').filter(x=>x.endsWith('.tsx')).map(x=>'pages/'+x),...fs.readdirSync('src/renderer/src/components').filter(x=>x.endsWith('.tsx')).map(x=>'components/'+x)]
for(const name of files){const file='src/renderer/src/'+name;let s=fs.readFileSync(file,'utf8')
 if(name==='store.tsx'){
 s="import {message, type UiMessage} from '../../shared/i18n/message'\n"+s
 s=s.replaceAll('text: string, kind','text: UiMessage, kind')
 s=s.replaceAll("'Kaydedilemedi: ' + e.message","message('store.saveFailed', {detail:e.message})").replace('`✓ ${job.assetName} hazır (${job.pipelineName})`',"message('store.ready', {name:job.assetName,pipeline:job.pipelineName})").replace("'Bekleyen iş başlatılamadı: ' + e.message","message('store.deferredFailed', {detail:e.message})").replace('`${job.assetName} bitmediği için ${n} bekleyen animasyon işi iptal edildi`',"message('store.animationsCanceled', {name:job.assetName,count:n})").replace('`✗ ${job.assetName}: ${job.error ?? \'hata\'}`',"job.error ? message('store.jobFailed', {name:job.assetName,detail:job.error}) : message('store.jobFailedWithoutDetail', {name:job.assetName})")
 }
 if(name==='App.tsx')s="import {renderMessage} from '../../shared/i18n/message'\n"+s.replace('{t.text}','{renderMessage(locale,t.text)}')
 const ast=parser.parse(s,{sourceType:'module',plugins:['typescript','jsx']}),edits=[]
 function walk(n){if(!n||typeof n!=='object')return
 if(n.type==='CallExpression'&&n.callee.name==='toast'&&n.arguments[0]?.type==='CallExpression'&&n.arguments[0].callee.name==='t')edits.push(n.arguments[0].callee.start)
 for(const[k,v]of Object.entries(n))if(k!=='loc'){if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v)}}walk(ast)
 for(const i of edits.sort((a,b)=>b-a))s=s.slice(0,i)+'message'+s.slice(i+1)
 if(edits.length)s=`import {message} from '${name.includes('/')?'../../../':'../../'}shared/i18n/message'\n`+s
 fs.writeFileSync(file,s)
}
