const fs=require('fs'),parser=require('@babel/parser')
const files=process.argv.slice(2)
for(const file of files){
 const found=new Set(),src=fs.readFileSync(file,'utf8')
 const ast=parser.parse(src,{sourceType:'module',plugins:['typescript','jsx']})
 function walk(n,p){if(!n||typeof n!=='object')return
 if(n.type==='JSXText'){const v=n.value.replace(/\s+/g,' ').trim();if(/[a-zA-Z\u00c0-\u024f]/.test(v))found.add(v)}
 if(n.type==='StringLiteral'&&((p?.type==='JSXAttribute'&&['title','placeholder','label','help','desc','aria-label'].includes(p.name.name)) || /[\u00c0-\u024f]/.test(n.value)))found.add(n.value)
 for(const[k,v]of Object.entries(n))if(k!=='loc'){if(Array.isArray(v))v.forEach(x=>walk(x,n));else if(v&&typeof v==='object')walk(v,n)}}
 walk(ast,null);console.log(file+'\n'+[...found].map(s=>JSON.stringify(s)).join('\n'))
}
