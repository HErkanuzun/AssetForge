const fs=require('fs'),parser=require('@babel/parser'),crypto=require('crypto')
const parse=s=>parser.parse(s,{sourceType:'module',plugins:['typescript','jsx']})
const rows={}
for(const line of fs.readFileSync('settings-translations.txt','utf8').trim().split(/\r?\n/)){const [en,zh,tr]=line.split('|'); if(!tr)throw Error(line); rows['panel.'+crypto.createHash('sha256').update(tr).digest('hex').slice(0,10)]=[en,zh,tr]}
fs.writeFileSync('src/shared/i18n/panels.ts',`// SPDX-License-Identifier: AGPL-3.0-only\nexport const panelRows = ${JSON.stringify(rows,null,2)} as const\n\nfunction column<I extends 0 | 1 | 2>(index: I) {\n return Object.fromEntries(Object.entries(panelRows).map(([key,row])=>[key,row[index]])) as {[K in keyof typeof panelRows]: (typeof panelRows)[K][I]}\n}\nexport const panelsEn=column(0)\nexport const panelsZh=column(1)\nexport const panelsTr=column(2)\n`)
const lookup=new Map(Object.entries(rows).map(([k,v])=>[v[2],k]))
const page=parse(fs.readFileSync('src/shared/i18n/pages.ts','utf8')).program.body.find(x=>x.type==='ExportNamedDeclaration').declaration.declarations[0].init.expression.properties
for(const p of page)if(!p.value.elements[0].value.includes('{'))lookup.set(p.value.elements[2].value,p.key.value)
for(const name of ['AgentClis','QuickConnect','ComfyLocal','ComfyServers','ComfyLibrary','CustomBackends']) {
 const file=`src/renderer/src/components/${name}.tsx`;let s=fs.readFileSync(file,'utf8'),edits=[],used=new Set()
 function walk(n,p,c){if(!n||typeof n!=='object')return
 if(n.type==='FunctionDeclaration')c=/^[A-Z]/.test(n.id.name)?n:null
 if(c){let v=n.type==='JSXText'?n.value.replace(/\s+/g,' ').trim():n.type==='StringLiteral'?n.value:null,k=lookup.get(v)
 const safe=n.type==='JSXText'||n.type==='StringLiteral'&& (p.type==='JSXAttribute'&&['title','label','placeholder','help','desc'].includes(p.name.name)||p.type==='ConditionalExpression'||p.type==='CallExpression'||p.type==='ObjectProperty'&&p.key!==n&&['label','help','message'].includes(p.key.name))
 if(k&&safe){let call=`t('${k}')`;edits.push([n.start,n.end,n.type==='JSXText'?` {${call}} `:p.type==='JSXAttribute'?`{${call}}`:call]);used.add(c)}}
 for(const[k,v]of Object.entries(n))if(k!=='loc'){if(Array.isArray(v))v.forEach(x=>walk(x,n,c));else if(v&&typeof v==='object')walk(v,n,c)}}
 walk(parse(s),null,null)
 for(const c of used)edits.push([c.body.start+1,c.body.start+1,'\n  const {t} = useLocale()\n'])
 for(const[a,b,v]of edits.sort((a,b)=>b[0]-a[0]))s=s.slice(0,a)+v+s.slice(b)
 if(edits.length)s="import { useLocale } from '../i18n'\n"+s
 fs.writeFileSync(file,s)
}
