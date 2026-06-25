'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { loadImpact, ImpactData } from '@/lib/impact-data'
import {
  ArrowRight, Sparkles, Factory, Brain, FileStack, Gauge, ClipboardList,
  BookCheck, Trophy, Heart, BookPlus, Database, Timer, Clock3, Users,
  School, Rocket, Flag, TrafficCone,
} from 'lucide-react'

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
  transition: { duration: 0.5, ease: 'easeOut' as const },
}

const ROUTINE = [
  { mins: 10, label: 'Hook', desc: 'Brain gym ดึงสมาธิที่โต๊ะ', color: 'bg-sky-500' },
  { mins: 15, label: 'Core', desc: 'บรรยายเข้มข้น กระชับ', color: 'bg-blue-600' },
  { mins: 20, label: 'Active', desc: 'เกมคู่หู + Quest Log', color: 'bg-indigo-600' },
  { mins: 5, label: 'Exit', desc: 'Exit Ticket วัดความเข้าใจ', color: 'bg-purple-600' },
]

const SYSTEMS = [
  { icon: BookPlus, title: 'โครงสร้างรายวิชา', desc: 'คลังตัวชี้วัดกลาง ครูติ๊กเลือก ไม่ต้องพิมพ์' },
  { icon: ClipboardList, title: 'แผน & จังหวะสอน', desc: 'ส่งแผนย่อ + เช็คอิน 3 สีทุกศุกร์' },
  { icon: Sparkles, title: 'ประเมิน 3 มิติใน 5 วิ', desc: 'ดาววิชาการ + ไฟสมาธิ + ทักษะสังคม' },
  { icon: BookCheck, title: 'การบ้าน QR', desc: 'สแกนปุ๊บ เช็คส่งงานปั๊บ' },
  { icon: Gauge, title: 'ศูนย์วิเคราะห์ไขว้', desc: 'จับ Speeding Hazard เตือนก่อนเด็กสอบตก' },
  { icon: Heart, title: 'การ์ดความสุขผู้ปกครอง', desc: 'รายงานถึงมือถือพ่อแม่ทุกศุกร์ผ่าน LINE' },
]

export default function ShowcasePage() {
  const [impact, setImpact] = useState<ImpactData | null>(null)
  useEffect(() => { loadImpact().then(setImpact).catch(() => {}) }, [])

  return (
    <div className="space-y-14 pb-16">
      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white px-6 py-12 text-center shadow-xl">
        <div className="absolute -left-10 -top-10 w-44 h-44 rounded-full bg-green-500/20 blur-2xl" />
        <div className="absolute right-0 top-16 w-36 h-36 rounded-full bg-yellow-400/20 blur-2xl" />
        <div className="absolute -right-6 -bottom-10 w-44 h-44 rounded-full bg-red-500/20 blur-2xl" />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-white/10 border border-white/20 rounded-full px-3 py-1.5">
            <TrafficCone size={12} /> นวัตกรรมการศึกษา · โรงเรียนอนุสรณ์ศุภมาศ จ.สมุทรสาคร
          </p>

          {/* traffic light */}
          <div className="flex items-center justify-center gap-3 mt-6">
            {['bg-red-500', 'bg-yellow-400', 'bg-green-500'].map((c, i) => (
              <motion.span key={c}
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ delay: 0.3 + i * 0.18, type: 'spring', stiffness: 260 }}
                className={`w-5 h-5 rounded-full ${c} shadow-lg`}
                style={{ boxShadow: `0 0 18px 2px var(--tw-shadow-color, rgba(255,255,255,0.25))` }}
              />
            ))}
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold mt-4 leading-tight">ไฟจราจรแห่งการเรียนรู้</h1>
          <p className="text-base sm:text-lg text-white/90 mt-2 font-medium">รู้จังหวะสอน · รู้ใจเด็ก · รายงานถึงใจผู้ปกครอง</p>
          <p className="text-sm text-white/60 mt-1">แพลตฟอร์ม Data-Driven Smart Routine ฉบับโรงเรียนในเมืองอุตสาหกรรม — Paperless 100% งบ 0 บาท</p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-7">
            <Link href="/teacher/pacing"
              className="inline-flex items-center justify-center gap-2 bg-white text-gray-900 text-sm font-bold px-6 py-3 rounded-2xl hover:bg-gray-100 transition-colors">
              ลองใช้ระบบจริง <ArrowRight size={16} />
            </Link>
            <Link href="/admin/impact"
              className="inline-flex items-center justify-center gap-2 bg-white/10 border border-white/25 text-white text-sm font-bold px-6 py-3 rounded-2xl hover:bg-white/20 transition-colors">
              <Flag size={15} /> ดูหลักฐานผลลัพธ์ (Impact)
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ============ THE STORY ============ */}
      <motion.section {...fadeUp}>
        <h2 className="text-xl font-extrabold text-gray-900 text-center">เรื่องจริงในเงาโรงงาน</h2>
        <p className="text-sm text-gray-500 text-center mt-1 max-w-md mx-auto">
          ความเหลื่อมล้ำทางการศึกษาไม่ได้อยู่แค่ชนบทห่างไกล — มันอยู่กลางเมืองอุตสาหกรรมที่ใครก็มองข้าม
        </p>
        <div className="grid sm:grid-cols-3 gap-3 mt-6">
          {[
            { icon: Factory, title: 'พ่อแม่เข้ากะโรงงาน', desc: 'ไม่มีเวลาดูการบ้านลูก และกังวลว่าลูกจะอ่านไม่ออกเขียนไม่ได้' },
            { icon: Brain, title: 'เด็กสมาธิสั้น พื้นที่จำกัด', desc: 'ช่วงสมาธิสั้นลงทุกปี ขณะที่โรงเรียนไม่มีสนามให้ปลดปล่อยพลังงาน' },
            { icon: FileStack, title: 'ครูจมกองกระดาษ', desc: 'แผนการสอน 20 หน้า สมุดพกคะแนน งานธุรการ — เวลาอยู่กับเด็กหายไป' },
          ].map(p => (
            <div key={p.title} className="bg-white border border-gray-200 rounded-2xl px-4 py-5 text-center shadow-sm">
              <p.icon size={26} className="mx-auto text-rose-500" />
              <p className="text-sm font-bold text-gray-800 mt-2">{p.title}</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* ============ ROUTINE 10-15-20-5 ============ */}
      <motion.section {...fadeUp}>
        <h2 className="text-xl font-extrabold text-gray-900 text-center">คำตอบเริ่มที่จังหวะ: ห้องเรียน 10-15-20-5</h2>
        <p className="text-sm text-gray-500 text-center mt-1">ออกแบบคาบเรียนตามช่วงสมาธิจริงของเด็ก — แล้วให้เทคโนโลยีตามเก็บข้อมูลทุกจังหวะ</p>
        <div className="flex gap-2 mt-6">
          {ROUTINE.map((r, i) => (
            <motion.div key={r.label}
              initial={{ opacity: 0, scaleY: 0.6 }} whileInView={{ opacity: 1, scaleY: 1 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className={`${r.color} text-white rounded-2xl px-2 py-4 text-center`}
              style={{ flexGrow: r.mins }}
            >
              <p className="text-2xl font-extrabold">{r.mins}′</p>
              <p className="text-xs font-bold mt-0.5">{r.label}</p>
              <p className="text-[10px] opacity-80 mt-1 leading-tight hidden sm:block">{r.desc}</p>
            </motion.div>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 text-center mt-2">ความกว้างของแต่ละช่วง = สัดส่วนเวลาจริงใน 50 นาที</p>
      </motion.section>

      {/* ============ SIGNATURE: CROSS-TRACKING ============ */}
      <motion.section {...fadeUp} className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-100 rounded-3xl px-5 py-7">
        <h2 className="text-xl font-extrabold text-gray-900 text-center">⚡ หัวใจนวัตกรรม: ไฟจราจร 2 ดวงที่ไขว้กัน</h2>
        <div className="grid sm:grid-cols-2 gap-3 mt-5">
          <div className="bg-white rounded-2xl px-4 py-4 shadow-sm">
            <p className="text-sm font-bold text-gray-800">🚦 ดวงที่ 1 — ใจเด็ก</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">ครูแตะบันทึกสมาธิรายคาบ 🟢 จดจ่อ / 🟡 วอกแวก / 🔴 หลุดลอย — เห็นภาวะสมาธิสั้นเป็นข้อมูล ไม่ใช่คำบ่น</p>
          </div>
          <div className="bg-white rounded-2xl px-4 py-4 shadow-sm">
            <p className="text-sm font-bold text-gray-800">🚦 ดวงที่ 2 — จังหวะครู</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">เช็คอินทุกศุกร์ 🟢 สอนตรงแผน / 🟡 เร็วกว่าแผน / 🔴 ช้าสะสม — ผอ. เห็นทั้งโรงเรียนในจอเดียว</p>
          </div>
        </div>
        <motion.div {...fadeUp} className="mt-4 bg-gray-900 text-white rounded-2xl px-5 py-4 text-center">
          <p className="text-sm font-bold">เมื่อสองดวงขัดกัน = "Speeding Hazard"</p>
          <p className="text-xs text-white/70 mt-1 leading-relaxed">
            ครูกดว่า "สอนจบแล้ว" แต่คะแนน Exit Ticket ของห้องร่วงและไฟสมาธิแดงพรืด →
            ระบบเปลี่ยนไฟห้องนั้นเป็นสีแดงเตือน ผอ. ทันที เพื่อชะลอความเร็วและซ่อมเสริม <strong>ก่อนเด็กจะสอบตกปลายภาค</strong>
          </p>
        </motion.div>
      </motion.section>

      {/* ============ LIVE NUMBERS ============ */}
      <motion.section {...fadeUp}>
        <h2 className="text-xl font-extrabold text-gray-900 text-center">ตัวเลขสดจากระบบจริง</h2>
        <p className="text-sm text-gray-500 text-center mt-1">ไม่ใช่ตัวเลขในสไลด์ — หน้านี้ดึงจากฐานข้อมูลที่ครูใช้อยู่ทุกวัน</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          {[
            { icon: Users, value: impact ? impact.counts.students.toLocaleString() : '…', label: 'นักเรียนในระบบ' },
            { icon: Database, value: impact ? impact.counts.totalRecords.toLocaleString() : '…', label: 'รายการข้อมูลแทนกระดาษ' },
            { icon: Timer, value: impact?.speed.medianSec != null ? `${impact.speed.medianSec} วิ` : 'กำลังวัด', label: 'ความเร็วบันทึก/รายการ (วัดจริง)' },
            { icon: Clock3, value: impact ? `${impact.speed.hoursSaved} ชม.` : '…', label: 'เวลาครูที่ได้คืน' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-2xl px-3 py-4 text-center shadow-sm">
              <s.icon size={18} className="mx-auto text-indigo-500" />
              <p className="text-xl font-extrabold text-gray-900 mt-1">{s.value}</p>
              <p className="text-[10px] text-gray-500 leading-tight mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* ============ 6 SYSTEMS ============ */}
      <motion.section {...fadeUp}>
        <h2 className="text-xl font-extrabold text-gray-900 text-center">6 ระบบ เชื่อมกันด้วยข้อมูลเดียว</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
          {SYSTEMS.map((s, i) => (
            <motion.div key={s.title}
              initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.05 }}
              className="bg-white border border-gray-200 rounded-2xl px-3.5 py-4 shadow-sm">
              <s.icon size={19} className="text-blue-600" />
              <p className="text-xs font-bold text-gray-800 mt-1.5">{s.title}</p>
              <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ============ WHO BENEFITS ============ */}
      <motion.section {...fadeUp} className="grid sm:grid-cols-3 gap-3">
        {[
          { emoji: '👩‍🏫', who: 'ครู', got: 'เลิกพิมพ์แผน 20 หน้า — เหลือแตะหน้าจอไม่กี่วินาที เวลาที่เหลือคืนให้เด็ก' },
          { emoji: '🧒', who: 'นักเรียน', got: 'ถูกมองเห็นรายคน — จุดอ่อนถูกจับก่อนสอบ แต้มฮีโร่ทำให้อยากมาโรงเรียน' },
          { emoji: '👨‍👩‍👧', who: 'ผู้ปกครอง', got: 'เปิดมือถือระหว่างพักกะ ก็เห็นการ์ดความสุขของลูกทุกศุกร์ — ความกังวลกลายเป็นความภูมิใจ' },
        ].map(b => (
          <div key={b.who} className="bg-white border border-gray-200 rounded-2xl px-4 py-5 text-center shadow-sm">
            <p className="text-3xl">{b.emoji}</p>
            <p className="text-sm font-bold text-gray-800 mt-1">{b.who}</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{b.got}</p>
          </div>
        ))}
      </motion.section>

      {/* ============ SCALE / CTA ============ */}
      <motion.section {...fadeUp} className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-3xl px-6 py-8 text-white text-center">
        <Rocket size={26} className="mx-auto" />
        <h2 className="text-xl font-extrabold mt-2">ขยายผลได้ด้วยงบ 0 บาท</h2>
        <p className="text-sm text-white/85 mt-2 max-w-md mx-auto leading-relaxed">
          ทั้งระบบรันบนบริการฟรี (Supabase + Cloudflare) ติดตั้งด้วยสคริปต์ชุดเดียวภายใน 1 วัน
          พร้อมคลังตัวชี้วัดกลางให้โรงเรียนเครือข่ายเริ่มใช้ได้ทันที — ความยั่งยืนที่ไม่ผูกกับงบประมาณ
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
          <Link href="/admin/impact/report"
            className="inline-flex items-center justify-center gap-2 bg-white text-emerald-700 text-sm font-bold px-6 py-3 rounded-2xl hover:bg-gray-100 transition-colors">
            <Flag size={15} /> รายงานผลการดำเนินงาน
          </Link>
          <Link href="/heroes"
            className="inline-flex items-center justify-center gap-2 bg-white/10 border border-white/25 text-white text-sm font-bold px-6 py-3 rounded-2xl hover:bg-white/20 transition-colors">
            <Trophy size={15} /> บอร์ดฮีโร่ของเด็กๆ
          </Link>
        </div>
      </motion.section>

      <footer className="text-center text-[11px] text-gray-400 space-y-1">
        <p className="flex items-center justify-center gap-1"><School size={12} /> โรงเรียนอนุสรณ์ศุภมาศ ต.ท่าทราย อ.เมืองสมุทรสาคร จ.สมุทรสาคร</p>
        <p>🚦 ไฟจราจรแห่งการเรียนรู้ — Suppamas Growth Engine</p>
      </footer>
    </div>
  )
}
