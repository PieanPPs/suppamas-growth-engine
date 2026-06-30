// Prompt Kit: ระบบเขียนพรอมต์ให้ครูเอาไปใช้กับเว็บ AI ฟรี (ChatGPT/Gemini/Claude)
// แล้วรับผลลัพธ์กลับมาแตกเป็นข้อสอบรายข้อ — ครูไม่ต้องพิมพ์เอง งบ 0 บาท

export interface ExamPromptOptions {
  subjectName: string
  grade?: string | null
  count: number
  indicators: { code: string; description: string }[]
}

export function buildExamPrompt(opts: ExamPromptOptions): string {
  const indicatorLines = opts.indicators.length
    ? opts.indicators.map(i => `- ${i.code}: ${i.description}`).join('\n')
    : '- (ตามเนื้อหาวิชา)'
  return `คุณเป็นครูผู้เชี่ยวชาญการออกข้อสอบตามหลักสูตรแกนกลางของไทย
ช่วยสร้างข้อสอบปรนัย 4 ตัวเลือก จำนวน ${opts.count} ข้อ
วิชา: ${opts.subjectName}${opts.grade ? ` ระดับชั้น ${opts.grade}` : ''}
ครอบคลุมตัวชี้วัดต่อไปนี้ และกระจายจำนวนข้อให้ครบทุกตัวชี้วัด:
${indicatorLines}

ข้อกำหนดสำคัญ:
- ภาษาเหมาะกับวัยผู้เรียน โจทย์ชัดเจน ตัวลวงสมเหตุสมผล
- ตอบกลับในรูปแบบด้านล่างนี้เท่านั้น ห้ามมีข้อความอื่นนำหน้าหรือต่อท้าย
- **บังคับ**: หลังเฉลยของทุกข้อ ต้องมีบรรทัด --- คั่นเสมอ ไม่มีข้อยกเว้น

ตัวอย่างรูปแบบ (ทำ ${opts.count} ข้อ ต่อกันแบบนี้):
ข้อ: 1
ตัวชี้วัด: ${opts.indicators[0]?.code ?? 'ป.5/1'}
คำถาม: (โจทย์ข้อที่ 1)
ก: (ตัวเลือก)
ข: (ตัวเลือก)
ค: (ตัวเลือก)
ง: (ตัวเลือก)
เฉลย: ก
---
ข้อ: 2
ตัวชี้วัด: ${opts.indicators[1]?.code ?? opts.indicators[0]?.code ?? 'ป.5/1'}
คำถาม: (โจทย์ข้อที่ 2)
ก: (ตัวเลือก)
ข: (ตัวเลือก)
ค: (ตัวเลือก)
ง: (ตัวเลือก)
เฉลย: ข
---`
}

export interface ParsedExamItem {
  item_no: number
  question: string
  choice_a: string | null
  choice_b: string | null
  choice_c: string | null
  choice_d: string | null
  answer: string | null
  indicator_code: string | null
}

const LABELS: { key: keyof ParsedExamItem | 'no'; re: RegExp }[] = [
  { key: 'no', re: /^ข้อ(?:ที่)?\s*[:：.]?\s*(\d+)/ },
  { key: 'indicator_code', re: /^ตัวชี้วัด\s*[:：]?\s*(.+)/ },
  { key: 'question', re: /^คำถาม\s*[:：]?\s*(.*)/ },
  { key: 'choice_a', re: /^ก\s*[.)\]:：]\s*(.*)/ },
  { key: 'choice_b', re: /^ข\s*[.)\]:：]\s*(.*)/ },
  { key: 'choice_c', re: /^ค\s*[.)\]:：]\s*(.*)/ },
  { key: 'choice_d', re: /^ง\s*[.)\]:：]\s*(.*)/ },
  { key: 'answer', re: /^เฉลย\s*[:：]?\s*([กขคง])/ },
]

/** แตกข้อความที่วางกลับจากเว็บ AI (หรือข้อสอบเก่าที่จัดรูปแบบเดียวกัน) เป็นรายข้อ */
export function parseExamText(text: string): { items: ParsedExamItem[]; warnings: string[] } {
  const warnings: string[] = []
  // Strip markdown heading markers (## ### etc.) that Gemini/Claude prepend to lines
  const cleaned = text.replace(/\r/g, '').replace(/^#{1,6}\s+/gm, '')
  let blocks = cleaned.split(/^\s*-{3,}\s*$/m).map(b => b.trim()).filter(Boolean)
  // Fallback: no --- found → split by "ข้อ: N" line starts so AI output without separators still parses
  if (blocks.length <= 1) {
    blocks = cleaned.split(/(?=^ข้อ(?:ที่)?\s*[:：.]?\s*\d+)/m).map(b => b.trim()).filter(Boolean)
  }
  const items: ParsedExamItem[] = []

  for (const block of blocks) {
    const item: ParsedExamItem = {
      item_no: 0, question: '', choice_a: null, choice_b: null,
      choice_c: null, choice_d: null, answer: null, indicator_code: null,
    }
    let lastField: keyof ParsedExamItem | null = null
    let matchedAny = false

    for (const rawLine of block.split('\n')) {
      const line = rawLine.trim()
      if (!line) continue
      let hit = false
      for (const { key, re } of LABELS) {
        const m = line.match(re)
        if (!m) continue
        hit = true; matchedAny = true
        if (key === 'no') {
          item.item_no = parseInt(m[1], 10)
          lastField = null
        } else if (key === 'answer') {
          item.answer = m[1]
          lastField = null
        } else {
          item[key] = m[1].trim() as never
          lastField = key
        }
        break
      }
      // continuation line (โจทย์/ตัวเลือกหลายบรรทัด)
      if (!hit && lastField) {
        item[lastField] = (((item[lastField] as string | null) ?? '') + ' ' + line).trim() as never
      }
    }

    if (!matchedAny || !item.question) continue
    if (!item.item_no) item.item_no = items.length + 1
    if (!item.answer) warnings.push(`ข้อ ${item.item_no}: ไม่พบเฉลย`)
    items.push(item)
  }

  // กันเลขข้อซ้ำ
  const seen = new Set<number>()
  items.forEach(it => {
    while (seen.has(it.item_no)) it.item_no++
    seen.add(it.item_no)
  })
  items.sort((a, b) => a.item_no - b.item_no)
  return { items, warnings }
}
