const fs=require('fs')
function edit(file,fn){fs.writeFileSync(file,fn(fs.readFileSync(file,'utf8')))}
edit('src/renderer/src/pages/DesignPage.tsx',s=>{
 s="import {panelLabel} from '../../../shared/i18n/display'\n"+s.replaceAll('const {t} = useLocale()', 'const {t,locale} = useLocale()')
 s=s.replace('{t.label}', '{panelLabel(locale,t.label)}').replace('{SCOPES.find((s) => s.value === l.scope)?.label}', "{panelLabel(locale,SCOPES.find(s=>s.value===l.scope)?.label ?? l.scope)}")
 s=s.replaceAll('`${s.label} (${s.hint})`','`${panelLabel(locale,s.label)} (${panelLabel(locale,s.hint)})`').replace('label: t.label', 'label: panelLabel(locale,t.label)').replace('placeholder={SECTION_HINT[section]}','placeholder={panelLabel(locale,SECTION_HINT[section])}').replace('options={ENGINES}','options={ENGINES.map(x=>({...x,label:panelLabel(locale,x.label)}))}').replace('options={WIDGETS}','options={WIDGETS.map(x=>({...x,label:panelLabel(locale,x.label)}))}')
 s=s.replace("{l.name || 'Adsız'}", "{l.name || panelLabel(locale,'Adsız')}")
 const pos=s.indexOf('function LoopNode'); const end=s.indexOf('function LoopsTab');if(!s.slice(pos,end).includes('useLocale()'))s=s.slice(0,pos)+s.slice(pos,end).replace('{\n','{\n  const {locale} = useLocale()\n')+s.slice(end)
 s=s.replace('const {t,locale} = useLocale()\n\n  const { project, update, toast }', 'const {t,locale} = useLocale()\n\n  const { project, update, toast }')
 return s
})
edit('src/renderer/src/components/ForgeNode.tsx',s=>{
 s="import {panelLabel} from '../../../shared/i18n/display'\nimport {translate,type Locale} from '../../../shared/i18n'\n"+s.replace('const {t} = useLocale()', 'const {t,locale} = useLocale()')
 s=s.replace('params: Record<string, ParamValue>): string', 'params: Record<string, ParamValue>, locale:Locale): string').replace("return PROMPT_TARGETS[String(params.target)]?.label ?? ''", "return panelLabel(locale,PROMPT_TARGETS[String(params.target)]?.label ?? '')")
 s=s.replace('`eşik ${params.min_score} · ${params.max_retries} deneme`', "translate(locale,'node.qaSummary', {score:String(params.min_score),count:String(params.max_retries)})").replace('`${params.variations} varyasyon`', "translate(locale,'node.variations', {count:String(params.variations)})").replace("|| 'bütçe'", "|| translate(locale,'surface.budget')")
 s=s.replaceAll('summary(def.type, data.params)', 'summary(def.type, data.params, locale)').replace('{CATEGORY_META[def.category].label}','{panelLabel(locale,CATEGORY_META[def.category].label)}')
 for(const x of ['def.label','inp.label','out.label'])s=s.replaceAll('{'+x+'}', '{panelLabel(locale,'+x+')}')
 return s
})
