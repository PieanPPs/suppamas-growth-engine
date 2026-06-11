'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { loadImpact, ImpactData } from '@/lib/impact-data'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts'
import {
  ArrowLeft, Loader2, TrendingUp, TrendingDown, Minus, Timer, FileText,
  Database, Clock3, Printer, Target, AlertTriangle, CheckCircle2, TrafficCone,
} from 'lucide-react'

function Delta({ before, after, goodWhenUp, unit }: { before: number | null; after: number | null; goodWhenUp: boolean; unit: string }) {
  if (before == null || after == null) return <Minus size={14} className="text-gray-300" />
  const diff = +(after - before).toFixed(2)
  if (diff === 0) return <span className="text-xs font-semibold text-gray-400 flex items-center gap-0.5"><Minus size={12} /> คงที่</span>
  const improved = goodWhenUp ? diff > 0 : diff < 0
  return (
    <span className={`text-xs font-bold flex items-center gap-0.5 ${improved ? 'text-green-600' : 'text-red-500'}`}>
      {diff > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
      {diff > 0 ? '+' : ''}{diff}{unit}
    </span>
  )
}

export default function ImpactPage() {
  const [data, setData] = useState<ImpactData | null>(null)

  useEffect(() => { loadImpact().then(setData) }, [])

  if (!data) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-orange-500" size={32} /></div>
  }

  const { counts, trends, beforeAfter, speed, coverage } = data

  const statCards = [
    { icon: Database, color: 'text-blue-500', value: counts.totalRecords.toLocaleString(), label: 'รายการข้อมูลดิจิทัล (แทนกระดาษ)' },
    { icon: Timer, color: 'text-green-500', value: speed.medianSec != null ? `${speed.medianSec} วิ` : '—', label: `ความเร็วบันทึก/รายการ (วัดจริง${speed.medianSec == null ? ' · รอข้อมูล' : ''})` },
    { icon: Clock3, color: 'text-orange-500', value: `${speed.hoursSaved} ชม.`, label: 'เวลาครูที่ประหยัด เทียบงานกระดาษ' },
    { icon: Target, color: 'text-purple-500', value: coverage ? `${coverage.covered}/${coverage.total}` : '—', label: 'ตัวชี้วัดที่สอนครอบคลุมแล้ว' },
  ]

  return (
    <div className="space-y-5 pb-8">
      <Link href="/admin/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> แดชบอร์ด
      </Link>

      {/* Innovation banner */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-rose-500 to-purple-600 text-white px-5 py-5 shadow-lg">
        <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" />
        <p className="text-xs font-medium opacity-90 flex items-center gap-1.5"><TrafficCone size={14} /> นวัตกรรมการศึกษา · โรงเรียนอนุสรณ์ศุภมาศ</p>
        <h2 className="text-xl font-extrabold mt-1">ไฟจราจรแห่งการเรียนรู้ 🚦</h2>
        <p className="text-xs opacity-90 mt-0.5">รู้จังหวะสอน รู้ใจเด็ก — หลักฐานผลการดำเนินงาน (Impact Evidence)</p>
        <p className="text-[11px] opacity-75 mt-2">{data.termName} · สัปดาห์ที่ {data.currentWeek} · นักเรียน {counts.students} คน · ครู {counts.teachers} คน · {counts.classrooms} ห้อง</p>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="bg-white border border-gray-200 rounded-2xl px-4 py-3.5 shadow-sm">
            <c.icon size={18} className={c.color} />
            <p className="text-2xl font-extrabold text-gray-900 mt-1">{c.value}</p>
            <p className="text-[11px] text-gray-500 leading-snug">{c.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Before / After */}
      <div className="bg-white border border-gray-200 rounded-2xl px-4 py-4 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800 mb-1">เปรียบเทียบก่อน–หลัง</h3>
        {beforeAfter ? (
          <>
            <p className="text-xs text-gray-400 mb-3">{beforeAfter.beforeLabel} เทียบ {beforeAfter.afterLabel}</p>
            <div className="space-y-2.5">
              {beforeAfter.rows.map(r => (
                <div key={r.metric} className="flex items-center justify-between gap-2">
                  <p className="text-xs text-gray-600 flex-1">{r.metric}</p>
                  <span className="text-sm font-semibold text-gray-400">{r.before ?? '—'}{r.before != null ? r.unit : ''}</span>
                  <span className="text-gray-300">→</span>
                  <span className="text-sm font-bold text-gray-900">{r.after ?? '—'}{r.after != null ? r.unit : ''}</span>
                  <Delta before={r.before} after={r.after} goodWhenUp={r.goodWhenUp} unit={r.unit} />
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-gray-400 py-3">ยังมีข้อมูลไม่ครบ 2 สัปดาห์ — ระบบจะเปรียบเทียบให้อัตโนมัติเมื่อข้อมูลสะสมพอ</p>
        )}
      </div>

      {/* Trend charts */}
      {trends.length > 0 && (
        <>
          <div className="bg-white border border-gray-200 rounded-2xl px-2 py-4 shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 px-3 mb-2">คะแนน Exit Ticket เฉลี่ยรายสัปดาห์</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={trends}>
                <CartesianGrid stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={w => `สป.${w}`} />
                <YAxis domain={[0, 2]} tick={{ fontSize: 10, fill: '#9ca3af' }} width={28} />
                <Tooltip formatter={(v) => [`${v}/2`, 'คะแนนเฉลี่ย']} labelFormatter={w => `สัปดาห์ ${w}`} />
                <Line type="monotone" dataKey="avgScore" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl px-2 py-4 shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 px-3 mb-2">สมาธิ 🟢 และวินัยส่งงาน (%)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={trends}>
                <CartesianGrid stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={w => `สป.${w}`} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} width={28} />
                <Tooltip labelFormatter={w => `สัปดาห์ ${w}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line name="สมาธิเขียว %" type="monotone" dataKey="greenPct" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                <Line name="ส่งงานตรงเวลา %" type="monotone" dataKey="onTimePct" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Cross-tracking summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-2.5">
          <CheckCircle2 size={20} className="text-green-600 flex-shrink-0" />
          <div>
            <p className="text-lg font-extrabold text-green-700">{data.perfectCount}</p>
            <p className="text-[11px] text-green-600">บทเรียน Perfect Pacing</p>
          </div>
        </div>
        <div className={`rounded-2xl px-4 py-3 flex items-center gap-2.5 border ${data.hazardCount > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
          <AlertTriangle size={20} className={data.hazardCount > 0 ? 'text-red-500' : 'text-gray-300'} />
          <div>
            <p className={`text-lg font-extrabold ${data.hazardCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>{data.hazardCount}</p>
            <p className="text-[11px] text-gray-500">Speeding Hazard ที่ตรวจพบ</p>
          </div>
        </div>
      </div>

      {/* Export CTA */}
      <Link href="/admin/impact/report"
        className="flex items-center justify-center gap-2 w-full bg-gray-900 hover:bg-black text-white text-sm font-semibold py-3.5 rounded-2xl transition-colors">
        <Printer size={16} /> รายงานผลการดำเนินงาน 10 หัวข้อ (ฉบับส่งประกวด)
      </Link>
      <p className="text-[11px] text-gray-400 text-center -mt-2 flex items-center justify-center gap-1">
        <FileText size={11} /> เติมข้อมูลจริงจากระบบอัตโนมัติ · สั่งพิมพ์/บันทึก PDF ได้ทันที
      </p>
    </div>
  )
}
