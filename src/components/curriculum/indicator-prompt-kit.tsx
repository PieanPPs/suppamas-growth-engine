'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Copy, Check, Wand2, ClipboardPaste } from 'lucide-react'

function buildIndicatorPrompt(courseName: string, grade?: string | null): string {
  return `คุณเป็นผู้เชี่ยวชาญหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พ.ศ. 2551 (ฉบับปรับปรุง พ.ศ. 2560) ของไทย
ขอรายการตัวชี้วัดทั้งหมดของ วิชา${courseName}${grade ? ` ระดับชั้น ${grade}` : ''} ภาคเรียนที่ 1 และ 2

สำหรับแต่ละตัวชี้วัด ให้ระบุ:
1. มาตรฐานการเรียนรู้ (เช่น ค 1.1)
2. รหัสตัวชี้วัด (เช่น ป.5/1)
3. คำอธิบายตัวชี้วัดฉบับเต็มตามหลักสูตร
4. ประเภท: "ระหว่างทาง" หรือ "ปลายทาง" (ตามประกาศ สพฐ. เรื่องตัวชี้วัดระหว่างทางและปลายทาง)
5. สาระสำคัญ (K) — ความรู้หลักที่ตัวชี้วัดนี้ต้องการ
6. กระบวนการ/คำกริยาสำคัญ (P) — เช่น เขียน, แปลง, วิเคราะห์

ข้อกำหนดการตอบ (สำคัญมาก):
- ตอบบรรทัดละ 1 ตัวชี้วัด คั่นแต่ละคอลัมน์ด้วยเครื่องหมาย | เท่านั้น
- ห้ามมีหัวตาราง ห้ามมีข้อความนำหรือสรุปท้าย ห้ามใช้ตาราง Markdown

รูปแบบ:
มาตรฐาน | รหัส | คำอธิบาย | ประเภท | สาระสำคัญ | กระบวนการ

ตัวอย่าง:
ค 1.1 | ป.5/1 | เขียนเศษส่วนที่มีตัวส่วนเป็นตัวประกอบของ 10, 100, 1,000 ในรูปทศนิยม | ระหว่างทาง | ความสัมพันธ์ระหว่างเศษส่วนกับทศนิยม | เขียน, แปลง, เชื่อมโยง`
}

export function IndicatorPromptKit({
  courseName,
  grade,
  onClose,
  onOpenImport,
}: {
  courseName: string
  grade?: string | null
  onClose: () => void
  onOpenImport: () => void
}) {
  const [copied, setCopied] = useState(false)
  const prompt = useMemo(() => buildIndicatorPrompt(courseName, grade), [courseName, grade])

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
            <Wand2 size={16} className="text-violet-600" /> พรอมต์ AI — ตัวชี้วัด {courseName}
          </p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="bg-violet-50 border border-violet-100 rounded-xl px-3 py-2 text-xs text-violet-700 leading-relaxed">
            <strong>3 ขั้นตอน:</strong> ① คัดลอกพรอมต์ → ② วางใน ChatGPT / Gemini / Claude (ฟรี)
            → ③ คัดลอกคำตอบมาวางที่ "วางผลลัพธ์" — <strong>อย่าลืมตรวจทานกับหลักสูตรจริงก่อนใช้</strong>
          </div>
          <textarea
            readOnly
            value={prompt}
            rows={12}
            className="w-full text-xs font-mono border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 text-gray-700"
          />
        </div>

        <div className="p-4 border-t border-gray-100 grid grid-cols-2 gap-2">
          <button onClick={copy}
            className={`text-white text-sm font-semibold py-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors ${copied ? 'bg-green-500' : 'bg-violet-600 hover:bg-violet-700'}`}>
            {copied ? <><Check size={15} /> คัดลอกแล้ว</> : <><Copy size={15} /> คัดลอกพรอมต์</>}
          </button>
          <button onClick={onOpenImport}
            className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-semibold py-3 rounded-xl flex items-center justify-center gap-1.5 hover:bg-indigo-100">
            <ClipboardPaste size={15} /> ไปวางผลลัพธ์ →
          </button>
        </div>
      </motion.div>
    </div>
  )
}
