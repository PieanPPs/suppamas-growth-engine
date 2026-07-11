'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CurriculumModule, Course, Indicator, LessonPlan } from '@/lib/types'
import { MATH_PLAIN_TEXT_RULE, latexToPlainText } from '@/lib/exam-import'
import { getSchoolId } from '@/lib/school'
import { getSession } from '@/lib/auth'
import {
  Loader2, Copy, Check, ChevronLeft, Sparkles, ClipboardPaste, ArrowRight, BookPlus,
} from 'lucide-react'
import Link from 'next/link'

// ======= Parser =======
function parseAIOutput(rawText: string): Partial<LessonPlan> {
  // ดักแปลง LaTeX ที่ AI เผลอใส่มา (โดยเฉพาะแผนคณิตที่มีเศษส่วน) ให้เป็นข้อความอ่านออก
  const text = latexToPlainText(rawText)
  const extract = (key: string) => {
    const re = new RegExp(`===\\s*${key}\\s*===([\\s\\S]*?)(?====|$)`)
    return re.exec(text)?.[1]?.trim() ?? ''
  }
  return {
    indicators_interim: extract('ตัวชี้วัดระหว่างทาง') || null,
    indicators_final:   extract('ตัวชี้วัดปลายทาง')   || null,
    objectives_k:       extract('จุดประสงค์-K')        || null,
    objectives_p:       extract('จุดประสงค์-P')        || null,
    objectives_a:       extract('จุดประสงค์-A')        || null,
    key_content:        extract('สาระสำคัญ')            || null,
    competencies:       extract('สมรรถนะสำคัญ')         || null,
    desired_traits:     extract('คุณลักษณะอันพึงประสงค์') || null,
    activities:         extract('กิจกรรมการเรียนรู้')    || null,
    assessment:         extract('การวัดและประเมินผล')   || null,
    materials:          extract('สื่อและแหล่งการเรียนรู้') || null,
  }
}

// ======= Prompt extras =======
// ท่อนพรอมต์สำเร็จรูปให้ครูเลือกแทรกในแผน — เลือกได้หลายแบบพร้อมกัน หรือ copy
// เฉพาะท่อนไปใช้ต่อยอดกับแผนที่ AI ตอบมาแล้วก็ได้ (เป็นข้อความต่อท้ายในแชทเดิม)
const PROMPT_EXTRAS: { key: string; label: string; desc: string; text: string }[] = [
  {
    key: 'adhd',
    label: 'เด็กสมาธิสั้น',
    desc: 'กิจกรรมสั้น สลับบ่อย มีการเคลื่อนไหว',
    text: 'ห้องเรียนมีเด็กสมาธิสั้น (ADHD) — แบ่งกิจกรรมเป็นช่วงสั้น ๆ ช่วงละไม่เกิน 10 นาที สลับระหว่างนั่งฟังกับลงมือทำ/เคลื่อนไหวร่างกาย มีสัญญาณบอกก่อนเปลี่ยนกิจกรรม และมอบบทบาทให้เด็กกลุ่มนี้มีส่วนร่วม เช่น ผู้ช่วยแจกอุปกรณ์ ผู้จับเวลา',
  },
  {
    key: 'slow',
    label: 'เด็กเรียนช้า/ตามไม่ทัน',
    desc: 'มีตัวช่วย ลดขั้นตอน จับคู่เพื่อนช่วยสอน',
    text: 'มีนักเรียนที่เรียนช้า/ตามไม่ทัน — เพิ่มตัวช่วย (scaffold) เช่น บัตรคำใบ้ ตัวอย่างที่ทำให้ดูทีละขั้น ลดจำนวนข้อฝึกลงแต่คงเป้าหมายเดิม และจัดระบบเพื่อนช่วยเพื่อน (peer tutoring) โดยระบุวิธีจับคู่ให้ชัดเจน',
  },
  {
    key: 'gifted',
    label: 'เด็กเก่ง/เรียนเร็ว',
    desc: 'โจทย์ท้าทายต่อยอดสำหรับคนทำเสร็จก่อน',
    text: 'มีนักเรียนเก่ง/เรียนเร็วที่มักทำเสร็จก่อนเพื่อน — เตรียมกิจกรรมต่อยอด (enrichment) เช่น โจทย์ท้าทายระดับสูงขึ้น ภารกิจพิเศษ หรือบทบาทผู้ช่วยครูสอนเพื่อน โดยระบุไว้ในกิจกรรมการเรียนรู้ให้ชัดว่าช่วงไหนใช้',
  },
  {
    key: 'behavior',
    label: 'แก้ปัญหาพฤติกรรมในชั้นเรียน',
    desc: 'ข้อตกลงชั้นเรียน แรงเสริมเชิงบวก',
    text: 'ห้องเรียนมีปัญหาพฤติกรรม เช่น คุยเสียงดัง ไม่อยู่ในกติกา — สอดแทรกเทคนิคจัดการชั้นเรียนเชิงบวกในแผน เช่น ทบทวนข้อตกลงชั้นเรียนตอนเริ่มคาบ ระบบสะสมแต้มกลุ่ม การชมเชยพฤติกรรมที่ต้องการทันทีที่เห็น และกำหนดสัญญาณเงียบที่ใช้ทั้งคาบ',
  },
  {
    key: 'game',
    label: 'เกม/การแข่งขัน',
    desc: 'เปลี่ยนกิจกรรมฝึกเป็นเกมสนุก ๆ',
    text: 'ออกแบบกิจกรรมฝึกปฏิบัติ (Active Practice) ให้อยู่ในรูปเกมหรือการแข่งขันเป็นทีม เช่น เกมตอบเร็ว บิงโก เกมส่งต่อคำตอบ โดยอธิบายกติกา อุปกรณ์ และวิธีคิดคะแนนให้ครบ พร้อมระบุว่าใช้เวลากี่นาที',
  },
  {
    key: 'reallife',
    label: 'เชื่อมโยงชีวิตจริง/ท้องถิ่น',
    desc: 'ใช้ตัวอย่างใกล้ตัวนักเรียนและชุมชน',
    text: 'ยกตัวอย่างและโจทย์ให้เชื่อมโยงกับชีวิตจริงของนักเรียนและบริบทท้องถิ่น (เช่น ตลาด ร้านค้า อาชีพในชุมชน จังหวัดสมุทรสาคร) แทนตัวอย่างลอย ๆ เพื่อให้นักเรียนเห็นว่าเรื่องนี้ใช้จริงได้ที่ไหน',
  },
  {
    key: 'lowresource',
    label: 'สื่อประหยัด/หาง่าย',
    desc: 'ไม่พึ่งเทคโนโลยี ใช้ของที่มีในห้อง',
    text: 'ห้องเรียนไม่มีโปรเจกเตอร์/อินเทอร์เน็ต — ออกแบบกิจกรรมและสื่อโดยใช้เฉพาะอุปกรณ์หาง่าย เช่น กระดาษ บัตรคำ กระดานดำ ของจริงใกล้ตัว และระบุวิธีเตรียมสื่อล่วงหน้าให้ครูอย่างชัดเจน',
  },
]

// ======= Prompt builder =======
function buildPrompt(opts: {
  subjectName: string
  grade: string
  moduleName: string
  topic: string
  indicators: Indicator[]
  duration: string
  extras: string[]
  customNote: string
}) {
  // split by type so the AI doesn't have to guess which selected indicator goes under
  // ===ตัวชี้วัดระหว่างทาง=== vs ===ตัวชี้วัดปลายทาง=== -- the teacher already told us via the tabs.
  // Also group by มาตรฐาน (standard) within each so the AI's plan can reference the standard
  // directly and the teacher can see at a glance which indicators sit under which standard.
  const interim = opts.indicators.filter(i => i.type === 'interim')
  const final = opts.indicators.filter(i => i.type === 'final')
  const byStandard = (list: Indicator[]) => {
    const map = new Map<string, Indicator[]>()
    list.forEach(i => {
      const key = i.standard || 'ไม่ระบุมาตรฐาน'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(i)
    })
    return map
  }
  const fmt = (list: Indicator[]) => list.length
    ? Array.from(byStandard(list)).map(([standard, inds]) =>
        `  มาตรฐาน ${standard}:\n${inds.map(i => `    - ${i.code}: ${i.description}`).join('\n')}`
      ).join('\n')
    : '  - (ไม่ได้เลือก)'
  const indList = opts.indicators.length
    ? `ตัวชี้วัดระหว่างทาง (ที่ครูเลือก):\n${fmt(interim)}\nตัวชี้วัดปลายทาง (ที่ครูเลือก):\n${fmt(final)}`
    : '  - (ครูระบุตัวชี้วัดเอง)'

  // ข้อกำหนดพิเศษจากครู (ท่อนสำเร็จรูปที่เลือก + ข้อความอิสระ) — ให้ AI สอดแทรกในกิจกรรม
  const extraLines = [
    ...opts.extras,
    ...(opts.customNote.trim() ? [opts.customNote.trim()] : []),
  ]
  const extraBlock = extraLines.length
    ? `\nข้อกำหนดพิเศษจากครู (สำคัญมาก — ต้องสอดแทรกให้เห็นชัดเจนในกิจกรรมการเรียนรู้ ห้ามละเลย):\n${extraLines.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n`
    : ''

  return `คุณคือผู้เชี่ยวชาญด้านการออกแบบการเรียนรู้เชิงรุก (Active Learning) สำหรับโรงเรียนในประเทศไทย

จงเขียนแผนการจัดการเรียนรู้ 1 คาบ โดยใช้หลักการ Active Learning ที่มีขั้นตอนชัดเจน

ข้อมูลบทเรียน:
- รายวิชา: ${opts.subjectName} ชั้น ${opts.grade}
- หน่วยการเรียนรู้: ${opts.moduleName}
- เรื่อง: ${opts.topic}
- เวลาเรียน: ${opts.duration}
- ตัวชี้วัดที่เกี่ยวข้อง:
${indList}
${extraBlock}
**กฎสำคัญ: ตอบเฉพาะรูปแบบที่กำหนดด้านล่าง ห้ามเพิ่มคำอธิบายนอกรูปแบบ**
${MATH_PLAIN_TEXT_RULE}

ตอบตามรูปแบบนี้ทุกหัวข้อ โดยใช้ ===หัวข้อ=== เป็นตัวแบ่งเท่านั้น:

===ตัวชี้วัดระหว่างทาง===
[คัดลอกรายการ "ตัวชี้วัดระหว่างทาง (ที่ครูเลือก)" ด้านบนมาทั้งหมด ห้ามเปลี่ยนแปลงหรือคัดออก]
===ตัวชี้วัดปลายทาง===
[คัดลอกรายการ "ตัวชี้วัดปลายทาง (ที่ครูเลือก)" ด้านบนมาทั้งหมด ห้ามเปลี่ยนแปลงหรือคัดออก]
===จุดประสงค์-K===
นักเรียน[ระบุสิ่งที่นักเรียนจะรู้/เข้าใจ] (K)
===จุดประสงค์-P===
นักเรียน[ระบุทักษะที่นักเรียนจะทำได้] (P)
===จุดประสงค์-A===
นักเรียน[ระบุเจตคติ/คุณลักษณะที่พึงประสงค์] (A)
===สาระสำคัญ===
[สรุปแก่นความรู้ของบทเรียนนี้ 2–4 ประโยค]
===สมรรถนะสำคัญ===
1. ความสามารถในการสื่อสาร
2. ความสามารถในการคิด
3. [เพิ่มตามความเหมาะสม]
===คุณลักษณะอันพึงประสงค์===
1. ใฝ่เรียนรู้
2. มุ่งมั่นในการทำงาน
===กิจกรรมการเรียนรู้===
[เขียนเป็นข้อ 1. 2. 3. ... ครอบคลุม 4 ช่วง: ①นำเข้าสู่บทเรียน (Hook) ②สอนเนื้อหา/สาธิต ③กิจกรรมเชิงรุก (Active Practice เช่น Think-Pair-Share, เกม, ใบงาน) ④สรุปบทเรียนและ Exit Ticket]
===การวัดและประเมินผล===
วิธีการ: [ระบุ] | เครื่องมือ: [ระบุ] | เกณฑ์: ร้อยละ 50 ขึ้นไปผ่านเกณฑ์
===สื่อและแหล่งการเรียนรู้===
1. [ระบุสื่อ/อุปกรณ์]
2. [เพิ่มเติม]
3. หนังสือเรียนรายวิชา${opts.subjectName} ชั้น ${opts.grade}`
}

export default function GenerateLessonPlanPage() {
  const supabase = createClient()
  const schoolId = getSchoolId()
  const router = useRouter()
  const searchParams = useSearchParams()
  const session = getSession()

  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // data
  const [modules, setModules] = useState<CurriculumModule[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [indicators, setIndicators] = useState<Indicator[]>([])
  const [existingPlans, setExistingPlans] = useState<Pick<LessonPlan, 'id' | 'topic' | 'plan_number'>[]>([])

  // step 1 inputs
  const [moduleId, setModuleId] = useState('')
  const [topic, setTopic] = useState('')
  const [duration, setDuration] = useState('1 ชั่วโมง')
  const [plannedWeek, setPlannedWeek] = useState<number | null>(null)
  const [selectedInds, setSelectedInds] = useState<Set<string>>(new Set())
  const [indTypeTab, setIndTypeTab] = useState<'all' | 'interim' | 'final'>('all')
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set())
  const [customNote, setCustomNote] = useState('')
  const [extraCopied, setExtraCopied] = useState<string | null>(null)
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [copied, setCopied] = useState(false)

  // step 2
  const [aiOutput, setAiOutput] = useState('')
  const [parsed, setParsed] = useState<Partial<LessonPlan> | null>(null)

  useEffect(() => {
    async function load() {
      const teacherId = session?.role === 'teacher' && session.userId ? session.userId : null
      const [{ data: mods }, { data: crs }] = await Promise.all([
        supabase.from('curriculum_modules').select('*').eq('school_id', schoolId).order('module_code'),
        supabase.from('courses').select('*').eq('school_id', schoolId).order('name'),
      ])
      let visibleMods = (mods ?? []) as CurriculumModule[]
      if (teacherId) {
        const { data: t } = await supabase.from('teachers').select('subjects').eq('id', teacherId).maybeSingle()
        const assigned = new Set<string>(t?.subjects ?? [])
        if (assigned.size > 0) visibleMods = visibleMods.filter(m => assigned.has(m.subject))
      }
      setModules(visibleMods)
      setCourses((crs ?? []) as Course[])
      // pre-select from ?module= URL param
      const paramModule = searchParams.get('module')
      if (paramModule) setModuleId(paramModule)
      setLoading(false)
    }
    load()
  }, [])

  // Load indicators + existing plans when module changes
  useEffect(() => {
    if (!moduleId) { setIndicators([]); setExistingPlans([]); return }
    const mod = modules.find(m => m.id === moduleId)
    if (!mod) return

    // default the week to ?week= from the URL (e.g. arrived from a specific week on the
    // pacing page) if it's within this module's span, else the module's own start week
    const span = Math.max(1, mod.expected_duration_weeks)
    const minWeek = mod.planned_week
    const maxWeek = minWeek != null ? minWeek + span - 1 : null
    const paramWeek = Number(searchParams.get('week'))
    const validParamWeek = minWeek != null && maxWeek != null && paramWeek >= minWeek && paramWeek <= maxWeek
      ? paramWeek : null
    setPlannedWeek(validParamWeek ?? minWeek)

    const teacherId = session?.role === 'teacher' && session.userId ? session.userId : null
    Promise.all([
      supabase.from('indicators').select('*').eq('subject', mod.subject).order('sequence_order'),
      teacherId
        ? supabase.from('lesson_plans').select('id, topic, plan_number')
            .eq('module_id', moduleId).eq('teacher_id', teacherId).order('plan_number')
        : Promise.resolve({ data: [] }),
    ]).then(([{ data: inds }, { data: plans }]) => {
      setIndicators((inds ?? []) as Indicator[])
      setExistingPlans((plans ?? []) as Pick<LessonPlan, 'id' | 'topic' | 'plan_number'>[])
    })
  }, [moduleId, modules])

  function toggleInd(id: string) {
    setSelectedInds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function getCourseFor(mod: CurriculumModule) {
    return courses.find(c => c.subject_key === mod.subject)
  }

  function handleGenerate() {
    const mod = modules.find(m => m.id === moduleId)
    if (!mod || !topic.trim()) return
    const course = getCourseFor(mod)
    const chosenInds = indicators.filter(i => selectedInds.has(i.id))
    const prompt = buildPrompt({
      subjectName: course?.name ?? mod.subject,
      grade: course?.grade ?? '',
      moduleName: mod.title,
      topic: topic.trim(),
      indicators: chosenInds,
      duration,
      extras: PROMPT_EXTRAS.filter(x => selectedExtras.has(x.key)).map(x => x.text),
      customNote,
    })
    setGeneratedPrompt(prompt)
  }

  function toggleExtra(key: string) {
    setSelectedExtras(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
    setGeneratedPrompt('')
  }

  // copy ท่อนเดียวแบบ standalone — ไว้วางต่อท้ายในแชท AI เดิมเพื่อปรับแผนที่ได้มาแล้ว
  async function copyExtraStandalone(key: string) {
    const extra = PROMPT_EXTRAS.find(x => x.key === key)
    if (!extra) return
    await navigator.clipboard.writeText(
      `จากแผนการสอนที่ตอบไปก่อนหน้า ช่วยปรับกิจกรรมการเรียนรู้เพิ่มเติมตามนี้ โดยคงรูปแบบ ===หัวข้อ=== เดิมไว้ทุกหัวข้อ:\n${extra.text}`
    )
    setExtraCopied(key)
    setTimeout(() => setExtraCopied(null), 2000)
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(generatedPrompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleParse() {
    if (!aiOutput.trim()) return
    setParsed(parseAIOutput(aiOutput))
  }

  async function handleSave() {
    if (!parsed || !moduleId || !topic.trim()) return
    setSaving(true)
    const mod = modules.find(m => m.id === moduleId)
    const course = getCourseFor(mod!)
    const teacherId = session?.role === 'teacher' && session.userId ? session.userId : null

    // reuse the same teacher+module-scoped count already shown in the "existing plans" banner,
    // so the number the teacher was shown and the number actually saved can never diverge
    const planNumber = existingPlans.length + 1

    const { data, error } = await supabase.from('lesson_plans').insert({
      school_id: schoolId,
      teacher_id: teacherId,
      module_id: moduleId,
      plan_number: planNumber,
      topic: topic.trim(),
      subject: course?.name ?? mod?.subject ?? null,
      grade: course?.grade ?? null,
      planned_week: plannedWeek,
      teach_dates: null,
      duration,
      ...parsed,
    }).select().single()

    setSaving(false)
    if (error) { alert(`บันทึกแผนไม่สำเร็จ: ${error.message}`); return }
    if (data) router.push(`/teacher/lesson-plans/${data.id}`)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="animate-spin text-violet-500" size={32} />
    </div>
  )

  return (
    <div className="space-y-5 pb-16">
      <div className="flex items-center gap-2">
        <Link href="/teacher/lesson-plans" className="text-gray-400 hover:text-gray-600">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Sparkles size={18} className="text-violet-600" /> สร้างแผนการสอนด้วย AI
          </h2>
          <p className="text-xs text-gray-500">เลือกเรื่อง → copy prompt → วาง AI → บันทึก</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex gap-2">
        {[1, 2].map(s => (
          <div key={s} className={`flex-1 h-1 rounded-full transition-colors ${step >= s ? 'bg-violet-500' : 'bg-gray-200'}`} />
        ))}
      </div>

      {/* ===== STEP 1 ===== */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-gray-700">ขั้นที่ 1 — กำหนดบทเรียนและสร้าง Prompt</p>

          {/* Module */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">หน่วยการเรียนรู้</label>
            <select value={moduleId} onChange={e => { setModuleId(e.target.value); setSelectedInds(new Set()); setGeneratedPrompt('') }}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-300">
              <option value="">เลือกหน่วยการเรียนรู้...</option>
              {modules.map(m => (
                <option key={m.id} value={m.id}>{m.module_code} — {m.title}</option>
              ))}
            </select>
          </div>

          {/* Existing plans for this module */}
          {moduleId && (
            <div className={`rounded-xl px-3 py-2.5 text-xs space-y-1.5 ${existingPlans.length > 0 ? 'bg-violet-50 border border-violet-100' : 'bg-gray-50 border border-gray-100'}`}>
              {existingPlans.length > 0 ? (
                <>
                  <p className="font-semibold text-violet-700">
                    มีแผนอยู่แล้ว {existingPlans.length} ชั่วโมง — กำลังสร้างแผนชั่วโมงที่ {existingPlans.length + 1}
                  </p>
                  <div className="space-y-0.5">
                    {existingPlans.map(p => (
                      <p key={p.id} className="text-violet-600">#{p.plan_number} {p.topic}</p>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-gray-500">กำลังสร้างแผนชั่วโมงที่ 1 สำหรับ module นี้</p>
              )}
            </div>
          )}

          {/* Topic */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">เรื่องที่สอน (รายชั่วโมง)</label>
            <input value={topic} onChange={e => { setTopic(e.target.value); setGeneratedPrompt('') }}
              placeholder="เช่น การบวกจำนวนนับที่มีผลบวกไม่เกิน 100,000 ไม่มีการทด"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-300" />
          </div>

          {/* Duration */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">เวลาเรียน</label>
            <select value={duration} onChange={e => { setDuration(e.target.value); setGeneratedPrompt('') }}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-300">
              {['1 ชั่วโมง', '2 ชั่วโมง', '50 นาที', '60 นาที', '90 นาที'].map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Week — which week (within the module's span) this specific topic is taught,
              so admins looking at week 8 can see exactly which topic that is */}
          {moduleId && (() => {
            const mod = modules.find(m => m.id === moduleId)
            if (!mod?.planned_week) return null
            const span = Math.max(1, mod.expected_duration_weeks)
            const weeks = Array.from({ length: span }, (_, i) => mod.planned_week! + i)
            return (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">
                  สัปดาห์ที่สอน <span className="text-gray-400">(หน่วยนี้อยู่ในช่วงสัปดาห์ {weeks[0]}–{weeks[weeks.length - 1]})</span>
                </label>
                <select value={plannedWeek ?? ''} onChange={e => setPlannedWeek(Number(e.target.value))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-300">
                  {weeks.map(w => <option key={w} value={w}>สัปดาห์ที่ {w}</option>)}
                </select>
              </div>
            )
          })()}

          {/* Indicators */}
          {indicators.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">
                ตัวชี้วัด <span className="text-gray-400">(เลือกที่เกี่ยวข้อง)</span>
              </label>

              {/* interim / final tab filter */}
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {([
                  ['all', `ทั้งหมด (${indicators.length})`],
                  ['interim', `ระหว่างทาง (${indicators.filter(i => i.type === 'interim').length})`],
                  ['final', `ปลายทาง (${indicators.filter(i => i.type === 'final').length})`],
                ] as const).map(([t, label]) => (
                  <button key={t} type="button" onClick={() => setIndTypeTab(t)}
                    className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-all ${indTypeTab === t ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="border border-gray-200 rounded-xl max-h-64 overflow-y-auto">
                {Array.from(
                  indicators
                    .filter(i => indTypeTab === 'all' || i.type === indTypeTab)
                    .reduce((map, ind) => {
                      const key = ind.standard || 'ไม่ระบุมาตรฐาน'
                      if (!map.has(key)) map.set(key, [])
                      map.get(key)!.push(ind)
                      return map
                    }, new Map<string, Indicator[]>())
                ).map(([standard, inds]) => (
                  <div key={standard} className="border-b border-gray-100 last:border-b-0">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-3 pt-2">มาตรฐาน {standard}</p>
                    <div className="divide-y divide-gray-100">
                      {inds.map(ind => (
                        <label key={ind.id} className="flex items-start gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50">
                          <input type="checkbox" checked={selectedInds.has(ind.id)} onChange={() => { toggleInd(ind.id); setGeneratedPrompt('') }}
                            className="mt-0.5 accent-violet-600 flex-shrink-0" />
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-semibold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">{ind.code}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ind.type === 'interim' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                                {ind.type === 'interim' ? 'ระหว่างทาง' : 'ปลายทาง'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-700 mt-0.5">{ind.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                {indicators.filter(i => indTypeTab === 'all' || i.type === indTypeTab).length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">ไม่มีตัวชี้วัดในหมวดนี้</p>
                )}
              </div>
            </div>
          )}

          {/* Prompt extras — ท่อนเสริมให้ครูเลือกแทรก เพิ่มความหลากหลาย/แก้ปัญหาเฉพาะห้อง */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600">
              พรอมต์เสริม <span className="text-gray-400">(เลือกได้หลายแบบ — หรือกดไอคอน copy เพื่อเอาท่อนเดียวไปวางต่อท้ายแผนที่ AI ตอบแล้ว)</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {PROMPT_EXTRAS.map(x => (
                <div key={x.key}
                  className={`flex items-start gap-2 rounded-xl border px-2.5 py-2 transition-colors ${selectedExtras.has(x.key) ? 'border-violet-400 bg-violet-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                  <button type="button" onClick={() => toggleExtra(x.key)} className="flex items-start gap-2 flex-1 text-left">
                    <input type="checkbox" readOnly checked={selectedExtras.has(x.key)}
                      className="mt-0.5 accent-violet-600 flex-shrink-0 pointer-events-none" />
                    <span>
                      <span className={`block text-xs font-semibold ${selectedExtras.has(x.key) ? 'text-violet-700' : 'text-gray-700'}`}>{x.label}</span>
                      <span className="block text-[10px] text-gray-400 leading-snug">{x.desc}</span>
                    </span>
                  </button>
                  <button type="button" onClick={() => copyExtraStandalone(x.key)}
                    title="copy เฉพาะท่อนนี้ ไปวางต่อท้ายในแชท AI เดิม"
                    className={`flex-shrink-0 p-1 rounded-md transition-colors ${extraCopied === x.key ? 'text-green-600' : 'text-gray-300 hover:text-gray-500'}`}>
                    {extraCopied === x.key ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              ))}
            </div>
            <textarea value={customNote} onChange={e => { setCustomNote(e.target.value); setGeneratedPrompt('') }}
              placeholder="คำแนะนำเพิ่มเติมถึง AI (ถ้ามี) เช่น ห้องนี้มีนักเรียน 35 คน โต๊ะจัดเป็นกลุ่มอยู่แล้ว..."
              rows={2}
              className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none" />
          </div>

          {/* Generate prompt */}
          <button onClick={handleGenerate} disabled={!moduleId || !topic.trim()}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold py-3 rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
            <Sparkles size={15} /> สร้าง Prompt
          </button>

          {/* Prompt output */}
          {generatedPrompt && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">Prompt พร้อมใช้ — Copy แล้วไปวางใน AI</p>
                <button onClick={copyPrompt}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors ${copied ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
                </button>
              </div>
              <textarea readOnly value={generatedPrompt} rows={10}
                className="w-full text-xs font-mono bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none resize-none text-gray-700" />
              <button onClick={() => setStep(2)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-3 rounded-xl flex items-center justify-center gap-2">
                ไปขั้นต่อไป <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== STEP 2 ===== */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-gray-700">ขั้นที่ 2 — วางผลลัพธ์จาก AI แล้วบันทึก</p>

          <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 text-xs text-blue-700 space-y-1">
            <p><strong>วิธีใช้:</strong></p>
            <p>1. Copy prompt จากขั้นที่ 1 → วางใน ChatGPT / Gemini / Claude</p>
            <p>2. AI ตอบกลับมา → Copy คำตอบทั้งหมด</p>
            <p>3. วางลงในช่องด้านล่าง → กดวิเคราะห์ → บันทึก</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">
              วางผลลัพธ์จาก AI ที่นี่
            </label>
            <textarea value={aiOutput} onChange={e => { setAiOutput(e.target.value); setParsed(null) }}
              placeholder="วางข้อความที่ได้จาก AI ทั้งหมดลงที่นี่..."
              rows={12}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-300 font-mono resize-none" />
          </div>

          {!parsed ? (
            <button onClick={handleParse} disabled={!aiOutput.trim()}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold py-3 rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
              <ClipboardPaste size={15} /> วิเคราะห์และแสดงตัวอย่าง
            </button>
          ) : (
            <div className="space-y-3">
              {/* Preview */}
              <div className="bg-white border border-emerald-200 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-bold text-emerald-700">ตัวอย่างแผนที่จะบันทึก</p>
                {[
                  ['จุดประสงค์ K', parsed.objectives_k],
                  ['จุดประสงค์ P', parsed.objectives_p],
                  ['จุดประสงค์ A', parsed.objectives_a],
                  ['สาระสำคัญ', parsed.key_content],
                  ['กิจกรรม', parsed.activities],
                  ['การวัดประเมิน', parsed.assessment],
                  ['สื่อ', parsed.materials],
                ].map(([label, val]) => val ? (
                  <div key={label as string}>
                    <p className="text-[10px] font-bold text-gray-500 uppercase mb-0.5">{label}</p>
                    <p className="text-xs text-gray-700 whitespace-pre-line line-clamp-3">{val}</p>
                  </div>
                ) : null)}
              </div>

              {Object.values(parsed).filter(Boolean).length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-700">
                  ไม่พบข้อมูล — ตรวจสอบว่า AI ตอบตามรูปแบบ ===หัวข้อ=== หรือไม่
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setParsed(null)}
                  className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-50">
                  แก้ไขใหม่
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <BookPlus size={14} />}
                  บันทึกแผน
                </button>
              </div>
            </div>
          )}

          <button onClick={() => setStep(1)} className="text-sm text-gray-400 hover:text-gray-600 w-full text-center">
            ← กลับขั้นที่ 1
          </button>
        </div>
      )}
    </div>
  )
}
