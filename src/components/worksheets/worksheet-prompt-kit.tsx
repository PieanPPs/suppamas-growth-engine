'use client'

// Prompt Kit ใบงาน: สร้างพรอมต์จากข้อมูลแผนการสอน ให้ครู copy ไปวางในเว็บ AI ฟรี
// แล้วได้ใบงานพร้อมพิมพ์กลับมา (วางใน Word/Docs แล้วปริ้นต์เอง) — แนวเดียวกับ Prompt Kit ข้อสอบ

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { LessonPlan } from '@/lib/types'
import { MATH_PLAIN_TEXT_RULE } from '@/lib/exam-import'
import { X, Copy, Check, FileText } from 'lucide-react'

const WS_TYPES: { key: string; label: string; desc: string; text: string }[] = [
  {
    key: 'practice',
    label: 'แบบฝึกหัดรายบุคคล',
    desc: 'ข้อฝึกทำตามเนื้อหาที่เพิ่งเรียน',
    text: 'ใบงานแบบฝึกหัดรายบุคคล ให้นักเรียนฝึกทำด้วยตนเองหลังเรียนจบ เรียงจากข้อง่ายไปยาก',
  },
  {
    key: 'group',
    label: 'ใบกิจกรรมกลุ่ม',
    desc: 'ภารกิจให้ทำร่วมกันเป็นกลุ่ม',
    text: 'ใบกิจกรรมกลุ่ม (3-4 คนต่อกลุ่ม) มีภารกิจให้ช่วยกันคิดและลงมือทำ ระบุบทบาทสมาชิกและช่องให้เขียนชื่อสมาชิกกลุ่ม',
  },
  {
    key: 'review',
    label: 'ใบงานทบทวน',
    desc: 'สรุป+ฝึกก่อนสอบ ครอบคลุมทั้งเรื่อง',
    text: 'ใบงานทบทวนความรู้ มีส่วนสรุปสาระสำคัญแบบเติมคำให้สมบูรณ์ ตามด้วยข้อฝึกคละรูปแบบครอบคลุมทั้งเรื่อง เหมาะใช้ก่อนสอบ',
  },
  {
    key: 'remedial',
    label: 'ใบงานซ่อมเสริม',
    desc: 'สำหรับเด็กที่ยังตามไม่ทัน ง่าย มีตัวช่วย',
    text: 'ใบงานซ่อมเสริมสำหรับนักเรียนที่ยังไม่ผ่านจุดประสงค์ ใช้ภาษาง่าย มีตัวอย่างวิธีทำให้ดูก่อน 1 ข้อ แล้วค่อยให้ฝึกทีละขั้น ข้อฝึกระดับพื้นฐานเท่านั้น',
  },
  {
    key: 'enrich',
    label: 'ใบงานต่อยอด',
    desc: 'ท้าทายเด็กเก่ง/ทำเสร็จก่อน',
    text: 'ใบงานต่อยอดสำหรับนักเรียนที่ทำงานหลักเสร็จก่อน มีโจทย์ท้าทายระดับคิดวิเคราะห์/เชื่อมโยงชีวิตจริง ปิดท้ายด้วยคำถามปลายเปิด 1 ข้อ',
  },
]

function buildWorksheetPrompt(plan: LessonPlan, opts: { typeText: string; count: number; note: string }): string {
  const indicators = [plan.indicators_interim, plan.indicators_final].filter(Boolean).join('\n')
  return `คุณเป็นครูผู้เชี่ยวชาญการออกแบบใบงานสำหรับนักเรียนไทย
ช่วยสร้างใบงาน 1 ชุด ให้พร้อมนำไปพิมพ์ใช้ได้ทันที

ข้อมูลบทเรียน:
- รายวิชา: ${plan.subject ?? ''} ชั้น ${plan.grade ?? ''}
- เรื่อง: ${plan.topic}
${plan.key_content ? `- สาระสำคัญ: ${plan.key_content}` : ''}
${indicators ? `- ตัวชี้วัดที่เกี่ยวข้อง:\n${indicators}` : ''}

ประเภทใบงาน: ${opts.typeText}
จำนวนข้อ/กิจกรรม: ${opts.count} ข้อ
${opts.note.trim() ? `ข้อกำหนดเพิ่มเติมจากครู: ${opts.note.trim()}\n` : ''}
ข้อกำหนดสำคัญ:
${MATH_PLAIN_TEXT_RULE}
- หัวใบงานมี: ชื่อใบงาน / เรื่อง / บรรทัดให้กรอก ชื่อ-สกุล .................... ชั้น ........ เลขที่ ........
- มีคำชี้แจงสั้น ๆ บอกวิธีทำที่ชัดเจน
- เนื้อหาสอดคล้องกับตัวชี้วัดข้างต้น ภาษาเหมาะกับวัยผู้เรียน
- เว้นที่ว่างให้นักเรียนเขียนตอบในแต่ละข้อ (ใช้บรรทัด ......... หรือกรอบตามเหมาะสม)
- ความยาวพอดี 1-2 หน้ากระดาษ A4
- ท้ายสุดให้แยกส่วน "เฉลยสำหรับครู" ออกมาชัดเจน (ขึ้นหัวข้อใหม่ ไม่ปนกับตัวใบงาน)
- ตอบเป็นเนื้อหาใบงานล้วน ๆ ไม่ต้องมีคำอธิบายอื่นนำหน้าหรือต่อท้าย`
}

export function WorksheetPromptKit({ plan, onClose }: { plan: LessonPlan; onClose: () => void }) {
  const [wsType, setWsType] = useState('practice')
  const [count, setCount] = useState(10)
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)

  const prompt = useMemo(() => {
    const t = WS_TYPES.find(x => x.key === wsType) ?? WS_TYPES[0]
    return buildWorksheetPrompt(plan, { typeText: t.text, count, note })
  }, [plan, wsType, count, note])

  async function copy() {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center sm:p-4">
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }}
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
            <FileText size={16} className="text-emerald-600" /> สร้างใบงานด้วย AI (ใช้กับเว็บ AI ฟรี)
          </p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 text-xs text-emerald-700 leading-relaxed">
            <strong>3 ขั้นตอน:</strong> ① คัดลอกพรอมต์นี้ → ② วางใน ChatGPT / Gemini / Claude
            → ③ นำใบงานที่ได้ไปวางใน Word/Google Docs แล้วสั่งพิมพ์
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-600">ประเภทใบงาน</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {WS_TYPES.map(t => (
                <button key={t.key} type="button" onClick={() => setWsType(t.key)}
                  className={`text-left rounded-xl border px-2.5 py-2 transition-colors ${wsType === t.key ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <span className={`block text-xs font-semibold ${wsType === t.key ? 'text-emerald-700' : 'text-gray-700'}`}>{t.label}</span>
                  <span className="block text-[10px] text-gray-400 leading-snug">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-500">
            จำนวนข้อ/กิจกรรม
            <input type="number" min={1} max={30} value={count}
              onChange={e => setCount(Math.max(1, Number(e.target.value) || 1))}
              className="w-20 text-sm text-center border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
            ข้อ · อิงเรื่อง &quot;{plan.topic}&quot;
          </label>

          <textarea value={note} onChange={e => setNote(e.target.value)}
            placeholder="ข้อกำหนดเพิ่มเติม (ถ้ามี) เช่น เน้นโจทย์การทดเลข อยากได้รูปแบบตารางให้เติม..."
            rows={2}
            className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none" />

          <textarea
            readOnly
            value={prompt}
            rows={9}
            className="w-full text-xs font-mono border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 text-gray-700"
          />
        </div>

        <div className="p-4 border-t border-gray-100">
          <button onClick={copy}
            className={`w-full text-white text-sm font-semibold py-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors ${copied ? 'bg-green-500' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
            {copied ? <><Check size={15} /> คัดลอกแล้ว — ไปวางในเว็บ AI ได้เลย</> : <><Copy size={15} /> คัดลอกพรอมต์</>}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
