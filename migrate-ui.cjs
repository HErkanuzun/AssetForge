const fs = require('fs')
const parser = require('@babel/parser')
const parse = s => parser.parse(s, {sourceType:'module',plugins:['typescript','jsx']})
const rows = parse(fs.readFileSync('src/shared/i18n/pages.ts','utf8')).program.body.find(x => x.type === 'ExportNamedDeclaration').declaration.declarations[0].init.expression.properties
const lookup = new Map(rows.filter(p => !p.value.elements[0].value.includes('{')).map(p => [p.value.elements[2].value, p.key.value]))
for (const name of ['LibraryPage','AssetsPage','JobsPage','BiblePage','BriefPage']) {
 const file = `src/renderer/src/pages/${name}.tsx`
 let s = fs.readFileSync(file,'utf8'), edits=[], used=new Set()
 function visit(n,parent,component) {
  if (!n || typeof n !== 'object') return
  if (n.type==='FunctionDeclaration') component=/^[A-Z]/.test(n.id.name)?n:null
  if (component) {
   let value=n.type==='JSXText'?n.value.replace(/\s+/g,' ').trim():n.type==='StringLiteral'?n.value:null
   const key=lookup.get(value)
   const unsafe=parent && (['BinaryExpression','ImportDeclaration','SwitchCase','ObjectProperty'].includes(parent.type) && !(parent.type==='ObjectProperty' && parent.key!==n && ['label','name','help'].includes(parent.key.name)))
   if (key && !unsafe) {
    const call=`t('${key}')`
    if(n.type==='JSXText') edits.push([n.start,n.end,` {${call}} `])
    else if(parent.type==='JSXAttribute') edits.push([n.start,n.end,`{${call}}`])
    else edits.push([n.start,n.end,call])
    used.add(component)
   }
  }
  for(const [k,v] of Object.entries(n)) if(k!=='loc') {if(Array.isArray(v)) v.forEach(x=>visit(x,n,component));else if(v&&typeof v==='object') visit(v,n,component)}
 }
 visit(parse(s),null,null)
 for(const c of used) edits.push([c.body.start+1,c.body.start+1,'\n  const { t, locale } = useLocale()\n'])
 for(const [a,b,v] of edits.sort((a,b)=>b[0]-a[0])) s=s.slice(0,a)+v+s.slice(b)
 if(edits.length) s="import { useLocale } from '../i18n'\n"+s
 fs.writeFileSync(file,s)
 console.log(name,edits.length)
}
