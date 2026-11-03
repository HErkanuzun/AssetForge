// SPDX-License-Identifier: AGPL-3.0-only
import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { columnIndex, isDateFormat, parseDelimited, readXlsx, serialToDate } from '../src/main/importers/spreadsheet'

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'

function xlsx(files: Record<string, string>): Uint8Array {
  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])))
}

function book(sheets: [string, string][], extra: Record<string, string> = {}, wbAttrs = ''): Uint8Array {
  const wb = `<?xml version="1.0"?><workbook ${NS}>${wbAttrs}<sheets>${sheets.map(([n], i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`
  const rels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="ws" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`
  const files: Record<string, string> = { 'xl/workbook.xml': wb, 'xl/_rels/workbook.xml.rels': rels, ...extra }
  sheets.forEach(([, data], i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = `<worksheet ${NS}><sheetData>${data}</sheetData></worksheet>`))
  return xlsx(files)
}

describe('xlsx okuyucu', () => {
  it('paylaşılan, satır içi ve zengin metinleri okur', () => {
    const ss = `<sst ${NS}><si><t>ID</t></si><si><r><rPr><b/></rPr><t xml:space="preserve">Kalın </t></r><r><t>sandık</t></r></si><si><t>A &amp; B &lt;x&gt; &#252;</t><rPh><t>fonetik</t></rPh></si><si/></sst>`
    const data =
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>' +
      '<row r="3"><c r="B3" t="inlineStr"><is><t>satır içi</t></is></c><c r="D3" t="s"><v>3</v></c></row>'
    const [s] = readXlsx(book([['Modeller', data]], { 'xl/sharedStrings.xml': ss }))
    expect(s.name).toBe('Modeller')
    expect(s.rows).toEqual([['ID', 'Kalın sandık', 'A & B <x> ü'], [], ['', 'satır içi', '', '']])
  })

  it('sayı, mantıksal, formül sonucu ve hata hücreleri', () => {
    const data =
      '<row r="1"><c r="A1"><v>0.30000000000000004</v></c><c r="B1" t="b"><v>1</v></c><c r="C1" t="str"><f>A1&amp;"!"</f><v>ok!</v></c><c r="D1" t="e"><v>#N/A</v></c><c r="E1"><f>1+1</f><v>2</v></c><c r="F1" s="0"/></row>'
    expect(readXlsx(book([['S', data]]))[0].rows).toEqual([['0.30000000000000004', 'true', 'ok!', '#N/A', '2', '']])
  })

  it('tarih biçimli hücreleri tarihe çevirir, yüzdeyi çevirmez', () => {
    const styles = `<styleSheet ${NS}><numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="0.0&quot;d&quot;"/></numFmts><cellStyleXfs><xf numFmtId="14"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0"/><xf numFmtId="14" applyNumberFormat="1"/><xf numFmtId="164"/><xf numFmtId="165"/></cellXfs></styleSheet>`
    const data = '<row r="1"><c r="A1" s="0"><v>45000</v></c><c r="B1" s="1"><v>45000</v></c><c r="C1" s="2"><v>46329</v></c><c r="D1" s="3"><v>2.5</v></c></row>'
    expect(readXlsx(book([['S', data]], { 'xl/styles.xml': styles }))[0].rows[0]).toEqual(['45000', '2023-03-15', '2026-11-03', '2.5'])
  })

  it('1904 tarih sistemi', () => {
    const styles = `<styleSheet ${NS}><cellXfs><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>`
    const rows = readXlsx(book([['S', '<row r="1"><c r="A1" s="1"><v>0</v></c></row>']], { 'xl/styles.xml': styles }, '<workbookPr date1904="1"/>'))[0].rows
    expect(rows[0]).toEqual(['1904-01-01'])
  })

  it('ad alanı önekli XML (x:c) ve r özniteliği olmayan hücreler', () => {
    const wb = `<x:workbook xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><x:sheets><x:sheet name="Palet" sheetId="1" r:id="R1"/></x:sheets></x:workbook>`
    const rels = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="R1" Type="ws" Target="/xl/worksheets/a.xml"/></Relationships>'
    const sheet =
      '<x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetData><x:row><x:c t="inlineStr"><x:is><x:t>Kod</x:t></x:is></x:c><x:c><x:v>7</x:v></x:c></x:row><x:row/><x:row><x:c t="inlineStr"><x:is><x:t>P1</x:t></x:is></x:c></x:row></x:sheetData></x:worksheet>'
    const [s] = readXlsx(xlsx({ 'xl/workbook.xml': wb, 'xl/_rels/workbook.xml.rels': rels, 'xl/worksheets/a.xml': sheet }))
    expect(s).toEqual({ name: 'Palet', rows: [['Kod', '7'], [], ['P1']] })
  })

  it('kendini kapatan satır sonraki satırı yutmaz; birden çok sayfa sırası korunur', () => {
    const one = '<row r="1" spans="1:2"/><row r="2"><c r="A2"><v>5</v></c></row>'
    const sheets = readXlsx(
      book([
        ['Bir', one],
        ['İki &amp; Üç', '']
      ])
    )
    expect(sheets.map((s) => s.name)).toEqual(['Bir', 'İki & Üç'])
    expect(sheets[0].rows).toEqual([[], ['5']])
    expect(sheets[1].rows).toEqual([])
  })

  it('_xHHHH_ kaçışlarını çözer', () => {
    const ss = `<sst ${NS}><si><t>a_x000D_b</t></si></sst>`
    expect(readXlsx(book([['S', '<row r="1"><c r="A1" t="s"><v>0</v></c></row>']], { 'xl/sharedStrings.xml': ss }))[0].rows[0]).toEqual(['a\rb'])
  })

  it('xlsx olmayan dosyayı açık bir hatayla reddeder', () => {
    expect(() => readXlsx(xlsx({ 'word/document.xml': '<w/>' }))).toThrow(/xlsx/)
    expect(() => readXlsx(new Uint8Array([1, 2, 3]))).toThrow()
  })

  it('yardımcılar', () => {
    expect(columnIndex('A1')).toBe(0)
    expect(columnIndex('Z9')).toBe(25)
    expect(columnIndex('AA10')).toBe(26)
    expect(columnIndex('BC12')).toBe(54)
    expect(serialToDate(1)).toBe('1899-12-31')
    expect(serialToDate(61)).toBe('1900-03-01')
    expect(isDateFormat('yyyy-mm-dd')).toBe(true)
    expect(isDateFormat('h:mm AM/PM')).toBe(true)
    expect(isDateFormat('0.00%')).toBe(false)
    expect(isDateFormat('[Red]#,##0')).toBe(false)
    expect(isDateFormat('0 "days"')).toBe(false)
  })
})

describe('CSV ayrıştırıcı', () => {
  it('tırnak içindeki ayırıcı, satır sonu ve "" kaçışı', () => {
    const text = 'ID,Ad,Not\r\nM-1,"Varil, paslı","2 satır\nnot"\nM-2,"""Sandık""",\n'
    expect(parseDelimited(text)).toEqual([
      ['ID', 'Ad', 'Not'],
      ['M-1', 'Varil, paslı', '2 satır\nnot'],
      ['M-2', '"Sandık"', '']
    ])
  })

  it('ayırıcıyı tahmin eder (; Excel TR, sekme)', () => {
    expect(parseDelimited('Kod;Ad;Boyut\nA;"x;y";1,5')).toEqual([
      ['Kod', 'Ad', 'Boyut'],
      ['A', 'x;y', '1,5']
    ])
    expect(parseDelimited('a\tb\n1\t2')).toEqual([
      ['a', 'b'],
      ['1', '2']
    ])
    expect(parseDelimited('a\tb,c', '\t')).toEqual([['a', 'b,c']])
  })

  it('boş satırları korur, sondaki satır sonunu yok sayar', () => {
    expect(parseDelimited('a,b\n\nc,d\n')).toEqual([['a', 'b'], [''], ['c', 'd']])
  })
})
