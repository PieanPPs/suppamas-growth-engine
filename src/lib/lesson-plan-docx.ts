import { LessonPlan } from '@/lib/types'

export type DocxLib = typeof import('docx')

export interface LessonPlanDocInput {
  plan: LessonPlan
  moduleTitle: string | null
  teacherName: string | null
  schoolName: string
  directorName: string | null
  logo: { data: ArrayBuffer; width: number; height: number } | null
}

export async function loadDocxLib(): Promise<DocxLib> {
  return await import('docx')
}

/** โหลดรูปโลโก้จาก URL public ของ Supabase Storage เป็น bytes + ขนาดจริง สำหรับฝังลง Word (คืน null ถ้าไม่มี/โหลดไม่ได้) */
export async function fetchLogoForDocx(url: string, maxSize = 70): Promise<{ data: ArrayBuffer; width: number; height: number } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.arrayBuffer()
    const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image()
      const blobUrl = URL.createObjectURL(new Blob([data]))
      img.onload = () => { URL.revokeObjectURL(blobUrl); resolve({ width: img.naturalWidth, height: img.naturalHeight }) }
      img.onerror = reject
      img.src = blobUrl
    })
    const fitted = fitLogoSize(dims.width, dims.height, maxSize)
    return { data, ...fitted }
  } catch {
    return null
  }
}

function formatThaiDates(dates: string[] | null): string {
  if (!dates?.length) return '..............................'
  return dates.map(d => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })).join(', ')
}

/** ย่อขนาดโลโก้ให้ไม่เกินความกว้าง/สูงที่กำหนด (คงสัดส่วน) — ใช้ตอนวางลงเอกสาร Word */
export function fitLogoSize(width: number, height: number, maxSize: number): { width: number; height: number } {
  const scale = Math.min(1, maxSize / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/** สร้างเนื้อหาแผนการสอน 1 แผน (Paragraph/Table[]) ตามฟอร์แมตแผนการจัดการเรียนรู้ราชการ — ใช้ได้ทั้งพิมพ์เดี่ยวและพิมพ์รวมหลายแผน */
export function buildLessonPlanBlock(docx: DocxLib, input: LessonPlanDocInput) {
  const { AlignmentType, Paragraph, TextRun, ImageRun, BorderStyle } = docx
  const { plan, moduleTitle, teacherName, schoolName, directorName, logo } = input

  const FONT = 'TH Sarabun New'
  const sz = (pt: number) => pt * 2 // docx uses half-points

  const run = (text: string, opts: { size?: number; bold?: boolean } = {}) =>
    new TextRun({ text, font: FONT, size: sz(opts.size ?? 16), bold: opts.bold })

  const line = (text: string, opts: { size?: number; bold?: boolean; center?: boolean; spacingAfter?: number } = {}) =>
    new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { after: opts.spacingAfter ?? 0 },
      children: [run(text, opts)],
    })

  const blank = () => new Paragraph({ children: [] })

  const section = (no: number, title: string, body: string | null) => [
    new Paragraph({
      spacing: { before: 120, after: 40 },
      children: [run(`${no}. ${title}`, { bold: true })],
    }),
    ...(body ?? '').split('\n').filter(Boolean).map(paraText => line(paraText)),
    ...(!body ? [line('')] : []),
  ]

  const nodes = []

  if (logo) {
    nodes.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new ImageRun({
        type: 'png',
        data: logo.data,
        transformation: { width: logo.width, height: logo.height },
        altText: { title: 'School logo', description: 'โลโก้โรงเรียน', name: 'logo' },
      })],
    }))
  }

  nodes.push(
    line(schoolName, { size: 16, bold: true, center: true }),
    blank(),
    line('แผนการจัดการเรียนรู้', { size: 18, bold: true, center: true }),
    line(`แผนการเรียนรู้ที่ ${plan.plan_number}    เรื่อง ${plan.topic}`, { size: 16, bold: true, center: true, spacingAfter: 100 }),
    line(`รายวิชา          ${plan.subject ?? ''}          ชั้น          ${plan.grade ?? ''}`),
    line(`หน่วยการเรียนรู้          ${moduleTitle ?? '..............................'}`, { spacingAfter: 100 }),
    new Paragraph({
      spacing: { after: 100 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000', space: 1 } },
      children: [run(`ครูผู้สอน          ${teacherName ?? '..............................'}          วันที่สอน          ${formatThaiDates(plan.teach_dates)}`)],
    }),
    ...section(1, 'มาตรฐานการเรียนรู้', [
      plan.indicators_interim ? `1.1 ตัวชี้วัดระหว่างทาง\n${plan.indicators_interim}` : null,
      plan.indicators_final ? `1.2 ตัวชี้วัดปลายทาง\n${plan.indicators_final}` : null,
    ].filter(Boolean).join('\n\n') || null),
    ...section(2, 'จุดประสงค์การเรียนรู้', [plan.objectives_k, plan.objectives_p, plan.objectives_a].filter(Boolean).join('\n') || null),
    ...section(3, 'สาระสำคัญ', plan.key_content),
    ...section(4, 'สมรรถนะสำคัญของผู้เรียน', plan.competencies),
    ...section(5, 'คุณลักษณะอันพึงประสงค์', plan.desired_traits),
    ...section(6, 'กิจกรรมการเรียนรู้', plan.activities),
    ...section(7, 'การวัดและประเมินผล', plan.assessment),
    ...section(8, 'สื่อ / แหล่งการเรียนรู้', plan.materials),
    ...section(9, 'บันทึกหลังการจัดการเรียนรู้', plan.post_lesson_note),
    ...section(10, 'ข้อเสนอแนะ', plan.suggestion),
    blank(),
  )

  nodes.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
      children: [
        run('ลงชื่อ ................................................'),
        run('     ลงชื่อ ................................................'),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        run(`( ${teacherName ?? '......................................'} )`),
        run('     '),
        run(`( ${directorName ?? '......................................'} )`),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        run('ครูผู้สอน', { size: 14 }),
        run('                              '),
        run(`ผู้อำนวยการ${schoolName}`, { size: 14 }),
      ],
    }),
  )

  return nodes
}
