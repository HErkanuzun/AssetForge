// SPDX-License-Identifier: AGPL-3.0-only
// Unreal'daki yapay zekâya (Unreal MCP'ye bağlanan herhangi bir ajan) projeyi öğretir:
// oyunun tasarımı ve AssetForge'un asset kuralları Unreal Agent Skill (UAsset) olarak yazılır.
import { designMarkdown } from '../../shared/design'
import type { Project } from '../../shared/types'
import { ueFindToolset, ueTool } from './ue'

export interface SkillSpec {
  assetName: string
  description: string
  instructions: string
}

const MAX = 14000

function clip(s: string, n = MAX): string {
  return s.length > n ? `${s.slice(0, n)}\n\n(… kısaltıldı; tamamı AssetForge’daki get_game_design aracında)` : s
}

/** Asset adı: PascalCase, yalnızca harf/rakam */
export function skillName(...parts: string[]): string {
  const tr: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'C', Ğ: 'G', İ: 'I', Ö: 'O', Ş: 'S', Ü: 'U' }
  return parts
    .join(' ')
    .replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => tr[c])
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('')
}

/** Projeden Unreal skill'lerini üretir */
export function buildSkills(p: Project): SkillSpec[] {
  const game = p.bible.projectName || p.name
  const t = p.bible.technical
  const root = t.ueContentRoot.replace(/\/$/, '')
  const n = t.naming
  const out: SkillSpec[] = []

  if (p.design) {
    out.push({
      assetName: skillName('AF', game, 'Game Design'),
      description: `${game} oyununun tasarımı (tasarım sütunları, oyun ve hikâye döngüleri, karakterler, arayüz ekranları). Oyuna mekanik, seviye, görev, UI ya da içerik eklerken ve bir özelliğin oyuna uyup uymadığına karar verirken kullan.`,
      instructions: clip(
        [
          'Bu oyunun tasarım dokümanı aşağıda. Kurallar:',
          '- Eklediğin her şey tasarım sütunlarından en az birine hizmet etmeli; çelişiyorsa kullanıcıya söyle.',
          '- Oyun döngülerindeki adımlar (eylem → zorluk → ödül → ilerleme) oyunda karşılığı olan sistemlerdir; bir adımı kuruyorsan bağlı olduğu döngüyü bozma.',
          '- UI kurarken ekran adlarını, öğeleri ve veri bağlantılarını buradaki listeden al; ekranlar arası geçişler buradaki akışa uysun.',
          '- Hikâye olayları ve karakter adları buradakiyle tutarlı olsun. Kullanıcı Türkçe konuşur.',
          '',
          designMarkdown(p)
        ].join('\n')
      )
    })
  }

  out.push({
    assetName: skillName('AF', game, 'Asset Rules'),
    description: `${game} için AssetForge’un ürettiği asset’lerin klasör, adlandırma ve kurulum kuralları; oyuna asset yerleştirirken, içe aktarılan asset’leri optimize ederken ya da araç / hareketli obje kurarken kullan.`,
    instructions: [
      `Asset’ler ${root}/<kategori>/ altında. Adlandırma: statik mesh ${n.staticMesh}, iskeletli mesh ${n.skeletalMesh}, doku ${n.texture}, materyal örneği ${n.materialInstance}, ses ${n.sound}.`,
      `Bütçe: varsayılan ${t.defaultTriBudget} üçgen, doku ${t.textureRes}${t.masterMaterial ? `, master materyal ${t.masterMaterial}` : ''}. Kategori kuralları:`,
      ...p.bible.categories.map((c) => `- ${c.code} ${c.name}: ${c.triBudget || t.defaultTriBudget} üçgen, ${c.textureRes}${c.styleNotes ? ` — ${c.styleNotes}` : ''}`),
      '',
      'Montajlı araçlar ve hareketli objeler (AssetForge montaj rigi):',
      '- Klasörleri <kategori>/<asset>/: iskeletli mesh, PA_ fizik asset’i, ABP_ araç Anim Blueprint’i, BP_ araç Blueprint’i, Anims/ (açılma/kapanma klipleri), Audio/ (kit sesleri, MS_*_Engine motor MetaSound’u).',
      '- Kemikler: root, her hareketli parça için bir kemik (tekerlek, kapı, kaput, bagaj…; pivot menteşede), efekt noktaları fx_* kemikleri (egzoz, far, toz, kıvılcım). Efekt eklerken bu kemiklere bağla.',
      '- Ezilme: dmg_* morph target’ları (ön, arka, sol, sağ…) ve vertex color R kanalı = hasar maskesi. Çarpışma hasarını morph ağırlığıyla ve materyalde maskeyle göster; tekerleklerde maske yok.',
      '- Motor sesi MetaSound’unun girişleri: RPM, Throttle ve RPMAlpha (0-1 devir oranı). Araç yalnızca oran gönderiyorsa RPMAlpha’yı kullan.',
      '- Araç Blueprint’leri projedeki KV araç şablonlarından türetilir: tekerlek yarıçapı/genişliği, kapılar, koltuklar, farlar ve egzoz montajdan ayarlıdır; elle değiştirirken montajla çelişme.',
      '',
      'İçe aktarılan asset’leri optimize ederken:',
      '- Üçgen sayısını bütçeyle karşılaştır; statik mesh’lerde Nanite uygunsa aç, iskeletli mesh’lerde LOD’ları (≈%50/%25/%10) kontrol et.',
      '- Çarpışma: statik mesh’lerde basit çarpışma; iskeletli mesh’lerde fizik asset’i kutuları gövdeyi sarmalı, tekerlekler fizik asset’ine girmez.',
      '- Dokular: renk sRGB, normal/maske doğrusal ve doğru sıkıştırma; gereksiz yüksek çözünürlüğü düşür.',
      '- Değişiklikten önce ve sonra kaydet; birden fazla asset’e dokunan işleri tek tek yap.',
      '',
      'Yeni asset gerekiyorsa (model, ses, doku, efekt): kullanıcıya AssetForge’da üretmesini öner ya da AssetForge MCP araçları erişilebilirse onları kullan.'
    ].join('\n')
  })
  return out
}

function textOf(r: unknown): string {
  return typeof r === 'string' ? r : JSON.stringify(r)
}

/** Skill'leri Unreal'a yazar (varsa günceller). Dönen: yapılanların listesi */
export async function teachUe(p: Project): Promise<string[]> {
  const ts = await ueFindToolset('CreateSkill')
  if (!ts) throw new Error('Unreal’da Agent Skill araç seti yok (Unreal MCP ve Toolset Registry eklentisi açık mı?)')
  const folder = `${p.bible.technical.ueContentRoot.replace(/\/$/, '')}/Skills/`
  const existing = textOf(await ueTool(ts, 'ListSkills', {}).catch(() => ''))
  const done: string[] = []
  for (const s of buildSkills(p)) {
    const found = new RegExp(`[\\w/]*/${s.assetName}\\.${s.assetName}(?:_C)?`).exec(existing)?.[0]
    if (found) {
      await callEither(ts, 'UpdateSkill', { skillPath: found, description: s.description, details: { instructions: s.instructions } })
      done.push(`güncellendi: ${found}`)
    } else {
      await callEither(ts, 'CreateSkill', { folderPath: folder, assetName: s.assetName, description: s.description, details: { instructions: s.instructions } })
      done.push(`oluşturuldu: ${folder}${s.assetName}`)
    }
  }
  return done
}

/** Araç parametre adları camelCase ya da PascalCase olabilir: önce biri, olmazsa öteki */
async function callEither(ts: string, tool: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    return await ueTool(ts, tool, args)
  } catch (e) {
    const pascal = (o: unknown): unknown => (o && typeof o === 'object' && !Array.isArray(o) ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k[0].toUpperCase() + k.slice(1), pascal(v)])) : o)
    try {
      return await ueTool(ts, tool, pascal(args) as Record<string, unknown>)
    } catch {
      throw e
    }
  }
}
