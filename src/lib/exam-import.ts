// Prompt Kit: ระบบเขียนพรอมต์ให้ครูเอาไปใช้กับเว็บ AI ฟรี (ChatGPT/Gemini/Claude)
// แล้วรับผลลัพธ์กลับมาแตกเป็นข้อสอบรายข้อ — ครูไม่ต้องพิมพ์เอง งบ 0 บาท

export type ExamQType = 'mc4' | 'truefalse' | 'fill' | 'short' | 'mixed'

export const EXAM_QTYPES: { key: ExamQType; label: string; desc: string }[] = [
  { key: 'mc4', label: 'ปรนัย 4 ตัวเลือก', desc: 'ก ข ค ง — ตรวจในระบบได้เต็มรูปแบบ' },
  { key: 'truefalse', label: 'ถูก / ผิด', desc: 'พิจารณาข้อความว่าถูกหรือผิด' },
  { key: 'fill', label: 'เติมคำตอบ', desc: 'โจทย์เว้นช่องว่างให้เติม' },
  { key: 'short', label: 'อัตนัยตอบสั้น', desc: 'เขียนตอบ/แสดงวิธีทำ พร้อมแนวคำตอบ' },
  { key: 'mixed', label: 'ผสมหลายแบบ', desc: 'ปรนัย + เติมคำ + อัตนัย ในชุดเดียว' },
]

// สไตล์โจทย์เสริม — เลือกได้หลายแบบ เพิ่มความหลากหลายของข้อสอบ
export const EXAM_STYLES: { key: string; label: string; text: string }[] = [
  { key: 'situation', label: 'โจทย์สถานการณ์/ชีวิตจริง', text: 'ออกโจทย์เป็นสถานการณ์ในชีวิตจริงของนักเรียน (เช่น การซื้อของ กิจกรรมที่โรงเรียน) อย่างน้อยครึ่งหนึ่งของชุด แทนโจทย์ถามตรง ๆ' },
  { key: 'hots', label: 'เน้นคิดวิเคราะห์ (HOTS)', text: 'เน้นข้อสอบระดับคิดวิเคราะห์/นำไปใช้ (ไม่ใช่ถามความจำอย่างเดียว) อย่างน้อย 40% ของชุด โดยให้โจทย์ต้องตีความหรือเชื่อมโยงมากกว่า 1 ขั้น' },
  { key: 'difficulty', label: 'คละความยาก 40/40/20', text: 'คละระดับความยาก: ง่าย 40% ปานกลาง 40% ยาก 20% เรียงจากง่ายไปยาก' },
  { key: 'local', label: 'บริบทท้องถิ่น', text: 'สอดแทรกบริบทท้องถิ่นใกล้ตัวนักเรียน (ชุมชน ตลาด อาชีพในจังหวัดสมุทรสาคร) ในโจทย์บางข้อเพื่อให้นักเรียนรู้สึกใกล้ตัว' },
  { key: 'data', label: 'โจทย์อ่านตาราง/ข้อมูล', text: 'มีโจทย์ที่ให้อ่านค่าจากตารางหรือชุดข้อมูลสั้น ๆ (เขียนตารางเป็นข้อความในตัวโจทย์ได้) อย่างน้อย 2-3 ข้อ เพื่อฝึกการอ่านข้อมูล' },
]

// กติกาเขียนคณิตศาสตร์เป็นข้อความธรรมดา — ใส่ในพรอมต์ทุกตัวที่อาจมีเนื้อหาคณิต/วิทย์
// เพราะครูคัดลอกผลลัพธ์กลับมาวางในระบบซึ่งแสดงผลเป็นข้อความล้วน ไม่ render LaTeX:
// สูตรที่สวยงามใน ChatGPT จะกลายเป็นโค้ดดิบอ่านไม่ออก เช่น \frac{3}{4}
export const MATH_PLAIN_TEXT_RULE =
  '- **ห้ามใช้โค้ด LaTeX หรือสูตรคณิตแบบ Markdown ทุกชนิด** (ห้ามมี \\frac, \\times, $...$, \\(...\\) ฯลฯ) เพราะระบบปลายทางแสดงผลเป็นข้อความล้วน ให้เขียนคณิตศาสตร์เป็นข้อความธรรมดาเท่านั้น: เศษส่วนใช้เครื่องหมายทับ เช่น 3/4, จำนวนคละเขียน 1 1/2, คูณใช้ ×, หารใช้ ÷, ยกกำลังใช้ ^ เช่น 2^3, รากที่สองใช้ √ เช่น √16'

export interface ExamPromptOptions {
  subjectName: string
  grade?: string | null
  count: number
  indicators: { code: string; description: string }[]
  qtype?: ExamQType
  styles?: string[]  // ข้อความสไตล์ที่เลือก (จาก EXAM_STYLES.text)
}

export function buildExamPrompt(opts: ExamPromptOptions): string {
  const qtype = opts.qtype ?? 'mc4'
  const indicatorLines = opts.indicators.length
    ? opts.indicators.map(i => `- ${i.code}: ${i.description}`).join('\n')
    : '- (ตามเนื้อหาวิชา)'
  const ind1 = opts.indicators[0]?.code ?? 'ป.5/1'
  const ind2 = opts.indicators[1]?.code ?? ind1

  const mcExample = (no: number, ans: string) => `ข้อ: ${no}
ตัวชี้วัด: ${no === 1 ? ind1 : ind2}
คำถาม: (โจทย์ข้อที่ ${no})
ก: (ตัวเลือก)
ข: (ตัวเลือก)
ค: (ตัวเลือก)
ง: (ตัวเลือก)
เฉลย: ${ans}
---`
  const plainExample = (no: number, questionHint: string, answerHint: string) => `ข้อ: ${no}
ตัวชี้วัด: ${no === 1 ? ind1 : ind2}
คำถาม: ${questionHint}
เฉลย: ${answerHint}
---`

  // กติกากระจายเฉลย — แก้ปัญหา AI เฉลย "ก" รัวทั้งชุด: สั่งชัด + ให้ตรวจนับก่อนส่ง
  const mcDistributionRules = `- **กระจายเฉลยให้สมดุลระหว่าง ก ข ค ง** (แต่ละตัวเลือกประมาณ 25% ของทั้งชุด) ห้ามเทเฉลยไปที่ตัวเลือกใดตัวเลือกหนึ่ง และห้ามเฉลยตัวเดียวกันติดกันเกิน 2 ข้อ
- ก่อนส่งคำตอบ ให้ตรวจนับจำนวนเฉลยของแต่ละตัวเลือกว่าใกล้เคียงกันจริง ถ้าไม่สมดุลให้สลับตำแหน่งตัวเลือกในข้อนั้นก่อนส่ง (เฉลยในตัวอย่างรูปแบบด้านล่างเป็นแค่ตัวอย่าง ไม่ใช่รูปแบบที่ต้องทำตาม)`

  const typeConfig: Record<ExamQType, { title: string; rules: string; example: string }> = {
    mc4: {
      title: `ข้อสอบปรนัย 4 ตัวเลือก จำนวน ${opts.count} ข้อ`,
      rules: mcDistributionRules,
      example: `${mcExample(1, 'ค')}\n${mcExample(2, 'ข')}`,
    },
    truefalse: {
      title: `ข้อสอบแบบถูก/ผิด จำนวน ${opts.count} ข้อ`,
      rules: `- แต่ละข้อเป็นข้อความให้นักเรียนพิจารณาว่า ถูก หรือ ผิด
- กระจายเฉลย "ถูก" และ "ผิด" ให้ใกล้เคียงกัน ห้ามเฉลยเดียวกันติดกันเกิน 3 ข้อ
- ข้อความที่ผิดต้องผิดจริงชัดเจน ไม่กำกวม`,
      example: `${plainExample(1, '(ข้อความให้พิจารณา)', 'ถูก')}\n${plainExample(2, '(ข้อความให้พิจารณา)', 'ผิด')}`,
    },
    fill: {
      title: `ข้อสอบแบบเติมคำตอบ จำนวน ${opts.count} ข้อ`,
      rules: `- โจทย์เว้นช่องว่างด้วย ______ ให้นักเรียนเติมคำตอบ
- เฉลยเป็นคำตอบสั้น ๆ ที่ชัดเจน มีคำตอบถูกเพียงแบบเดียว (ถ้ามีหลายรูปแบบที่ยอมรับได้ ให้เขียนคั่นด้วย "หรือ")`,
      example: `${plainExample(1, '(โจทย์ที่มี ______ ให้เติม)', '(คำตอบ)')}\n${plainExample(2, '(โจทย์ที่มี ______ ให้เติม)', '(คำตอบ)')}`,
    },
    short: {
      title: `ข้อสอบอัตนัยตอบสั้น/แสดงวิธีทำ จำนวน ${opts.count} ข้อ`,
      rules: `- โจทย์ให้นักเรียนเขียนตอบสั้น ๆ หรือแสดงวิธีทำ
- เฉลยเขียนเป็น "แนวคำตอบ" ที่ครูใช้ตรวจได้ กระชับไม่เกิน 2-3 บรรทัด พร้อมประเด็นที่ต้องมีในคำตอบ`,
      example: `${plainExample(1, '(โจทย์เขียนตอบ/แสดงวิธีทำ)', '(แนวคำตอบ: ประเด็นที่ต้องมี...)')}\n${plainExample(2, '(โจทย์เขียนตอบ/แสดงวิธีทำ)', '(แนวคำตอบ: ...)')}`,
    },
    mixed: {
      title: `ข้อสอบผสม จำนวน ${opts.count} ข้อ — แบ่งเป็น ปรนัย 4 ตัวเลือกประมาณ 60% เติมคำตอบประมาณ 20% และอัตนัยตอบสั้นประมาณ 20% (เรียงปรนัยก่อน ตามด้วยเติมคำ แล้วจึงอัตนัย เลขข้อต่อเนื่องกัน)`,
      rules: `- ข้อปรนัยต้องมีตัวเลือก ก ข ค ง ครบ / ข้อเติมคำและอัตนัยไม่ต้องมีตัวเลือก
${mcDistributionRules}
- เฉลยข้อเติมคำเป็นคำตอบสั้นชัดเจน / เฉลยข้ออัตนัยเขียนเป็นแนวคำตอบกระชับ`,
      example: `${mcExample(1, 'ค')}\n${plainExample(2, '(โจทย์ที่มี ______ ให้เติม)', '(คำตอบ)')}`,
    },
  }
  const cfg = typeConfig[qtype]

  const styleBlock = opts.styles?.length
    ? `\nสไตล์โจทย์ที่ครูต้องการ (ต้องทำตามทุกข้อกำหนด):\n${opts.styles.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n`
    : ''

  return `คุณเป็นครูผู้เชี่ยวชาญการออกข้อสอบตามหลักสูตรแกนกลางของไทย
ช่วยสร้าง${cfg.title}
วิชา: ${opts.subjectName}${opts.grade ? ` ระดับชั้น ${opts.grade}` : ''}
ครอบคลุมตัวชี้วัดต่อไปนี้ และกระจายจำนวนข้อให้ครบทุกตัวชี้วัด:
${indicatorLines}
${styleBlock}
ข้อกำหนดสำคัญ:
- ภาษาเหมาะกับวัยผู้เรียน โจทย์ชัดเจน ตัวลวงสมเหตุสมผล
${MATH_PLAIN_TEXT_RULE}
${cfg.rules}
- ตอบกลับในรูปแบบด้านล่างนี้เท่านั้น ห้ามมีข้อความอื่นนำหน้าหรือต่อท้าย
- **บังคับ**: หลังเฉลยของทุกข้อ ต้องมีบรรทัด --- คั่นเสมอ ไม่มีข้อยกเว้น

ตัวอย่างรูปแบบ (ทำ ${opts.count} ข้อ ต่อกันแบบนี้):
${cfg.example}`
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
  // เฉลยเป็นข้อความอิสระ — รองรับทั้งปรนัย (ก/ข/ค/ง) ถูก/ผิด เติมคำ และแนวคำตอบอัตนัย
  { key: 'answer', re: /^เฉลย\s*[:：]?\s*(.+)/ },
]

/** ถ้าเฉลยขึ้นต้นด้วยตัวเลือกปรนัยตามด้วยตัวคั่น/จบบรรทัด (เช่น "ก" "ข." "ค) เพราะ...") เก็บแค่ตัวอักษร — กัน AI แถมคำอธิบายท้ายเฉลย */
function normalizeAnswer(raw: string): string {
  const m = raw.trim().match(/^([กขคง])(?:\s*[.)\]:：]|\s|$)/)
  return m ? m[1] : raw.trim()
}

/**
 * แปลงโค้ดคณิตศาสตร์ LaTeX/Markdown ที่เว็บ AI ชอบแถมมา ให้เป็นข้อความธรรมดาอ่านออก
 * — พรอมต์สั่งห้ามใช้ LaTeX แล้ว (MATH_PLAIN_TEXT_RULE) แต่ AI มักเผลอใส่มาอยู่ดี
 * โดยเฉพาะโจทย์เศษส่วน จึงต้องดักแปลงฝั่งรับด้วยเสมอ
 */
export function latexToPlainText(text: string): string {
  let s = text
  const wrap = (v: string) => /^[\w๐-๙.,]+$/.test(v.trim()) ? v.trim() : `(${v.trim()})`
  // เศษส่วน \frac{a}{b} → a/b — วนซ้ำเพื่อรองรับเศษส่วนซ้อน (regex จับเฉพาะเนื้อในที่ไม่มีปีกกา
  // ดังนั้นตัวในสุดถูกแปลงก่อน แล้วรอบถัดไปตัวนอกจึงจับได้)
  const frac = /\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g
  let prev = ''
  while (prev !== s) { prev = s; s = s.replace(frac, (_, a, b) => `${wrap(a)}/${wrap(b)}`) }
  // รากที่สอง / รากที่ n
  s = s.replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g, (_, n, v) => `${n}√(${String(v).trim()})`)
  s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, (_, v) => `√(${String(v).trim()})`)
  // \text{...} และตระกูล mathrm — เอาเฉพาะเนื้อใน
  prev = ''
  while (prev !== s) { prev = s; s = s.replace(/\\(?:text|mathrm|mathbf|mathit|operatorname)\s*\{([^{}]*)\}/g, '$1') }
  // สัญลักษณ์ที่พบบ่อย
  const symbols: [RegExp, string][] = [
    [/\\times\b/g, '×'], [/\\div\b/g, '÷'], [/\\cdot\b/g, '·'], [/\\pm\b/g, '±'],
    [/\\leq?\b/g, '≤'], [/\\geq?\b/g, '≥'], [/\\neq?\b/g, '≠'], [/\\approx\b/g, '≈'],
    [/\\pi\b/g, 'π'], [/\\theta\b/g, 'θ'], [/\\alpha\b/g, 'α'], [/\\beta\b/g, 'β'],
    [/\\infty\b/g, '∞'], [/\\degree\b/g, '°'], [/\^\{?\\circ\}?/g, '°'], [/\\%/g, '%'],
    [/\\left\b/g, ''], [/\\right\b/g, ''],
    [/\\[,;:!]/g, ' '], [/\\quad\b/g, ' '], [/\\qquad\b/g, ' '],
  ]
  symbols.forEach(([re, to]) => { s = s.replace(re, to) })
  // ยกกำลัง/ตัวห้อยที่ครอบปีกกา: x^{12} → x^12, a_{1} → a_1
  s = s.replace(/([\^_])\{([^{}]*)\}/g, '$1$2')
  // ตัวคั่นสูตร — คงเนื้อในไว้: $$...$$, $...$, \(...\), \[...\]
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, '$1')
  s = s.replace(/\$([^$\n]*)\$/g, '$1')
  s = s.replace(/\\[()[\]]/g, '')
  // ตัวหนา Markdown (**ข้อ: 1**) ทำให้บรรทัดไม่เข้า pattern ของ label — ลอกออก
  s = s.replace(/\*\*/g, '')
  return s
}

/** แตกข้อความที่วางกลับจากเว็บ AI (หรือข้อสอบเก่าที่จัดรูปแบบเดียวกัน) เป็นรายข้อ */
export function parseExamText(text: string): { items: ParsedExamItem[]; warnings: string[] } {
  const warnings: string[] = []
  // Strip markdown heading markers (## ### etc.) that Gemini/Claude prepend to lines
  const cleaned = latexToPlainText(text.replace(/\r/g, '')).replace(/^#{1,6}\s+/gm, '')
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
          // เก็บดิบไว้ก่อน เผื่อแนวคำตอบอัตนัยยาวหลายบรรทัด (normalize ตอนจบ block)
          item.answer = m[1].trim()
          lastField = 'answer'
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
    if (item.answer) item.answer = normalizeAnswer(item.answer)
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
