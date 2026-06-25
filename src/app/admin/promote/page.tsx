'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getSchoolId } from '@/lib/school'
import { Student, Classroom, AcademicSettings } from '@/lib/types'
import {
  ArrowLeft, Loader2, GraduationCap, History, CheckCircle2, AlertTriangle,
  ChevronDown, Users, CalendarDays, ArrowRight,
} from 'lucide-react'

interface GradeHistoryRow {
  id: string
  academic_year: number
  student_id: string
  student_name: string
  student_number: string | null
  classroom_name: string
  grade_level: string
  created_at: string
}

function extractGrade(classroomName: string): string {
  const m = classroomName.match(/ป\.(\d)/)
  return m ? `ป.${m[1]}` : classroomName.split('/')[0].trim()
}

function nextGrade(grade: string): string | null {
  const map: Record<string, string> = {
    'ป.1': 'ป.2', 'ป.2': 'ป.3', 'ป.3': 'ป.4',
    'ป.4': 'ป.5', 'ป.5': 'ป.6',
  }
  return map[grade] ?? null
}

export default function PromotePage() {
  const supabase = createClient()
  const schoolId = getSchoolId()

  const [tab, setTab] = useState<'snapshot' | 'history'>('snapshot')
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<Student[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [settings, setSettings] = useState<AcademicSettings | null>(null)
  const [history, setHistory] = useState<GradeHistoryRow[]>([])
  const [savedYears, setSavedYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [academicYear, setAcademicYear] = useState<number>(2569)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: s }, { data: sts }, { data: cs }, { data: hist }] = await Promise.all([
        supabase.from('academic_settings').select('*').eq('school_id', schoolId).maybeSingle(),
        supabase.from('students').select('*').eq('school_id', schoolId).order('class_name').order('student_number'),
        supabase.from('classrooms').select('*').eq('school_id', schoolId).order('name'),
        supabase.from('student_grade_history').select('*').eq('school_id', schoolId).order('academic_year', { ascending: false }),
      ])
      const settingsRow = s as AcademicSettings | null
      setSettings(settingsRow)
      setStudents((sts ?? []) as Student[])
      setClassrooms((cs ?? []) as Classroom[])

      const rows = (hist ?? []) as GradeHistoryRow[]
      setHistory(rows)
      const years = Array.from(new Set(rows.map(r => r.academic_year))).sort((a, b) => b - a)
      setSavedYears(years)
      if (years.length > 0) setSelectedYear(years[0])

      // derive default academic year from term_start_date
      if (settingsRow?.term_start_date) {
        const ce = new Date(settingsRow.term_start_date).getFullYear()
        setAcademicYear(ce + 543)
      }
      setLoading(false)
    }
    load()
  }, [])

  // group students by classroom
  const byClassroom = new Map<string, Student[]>()
  students.forEach(s => {
    if (!byClassroom.has(s.class_name)) byClassroom.set(s.class_name, [])
    byClassroom.get(s.class_name)!.push(s)
  })
  const classroomNames = Array.from(byClassroom.keys()).sort()
  const alreadySaved = savedYears.includes(academicYear)

  async function saveSnapshot() {
    if (alreadySaved || saving) return
    setSaving(true)
    const rows = students.map(s => ({
      school_id: schoolId,
      academic_year: academicYear,
      student_id: s.id,
      student_name: s.name,
      student_number: s.student_number ?? null,
      classroom_name: s.class_name,
      grade_level: extractGrade(s.class_name),
    }))
    const BATCH = 200
    for (let i = 0; i < rows.length; i += BATCH) {
      await supabase.from('student_grade_history').insert(rows.slice(i, i + BATCH))
    }
    setSaving(false)
    setSavedFlash(true)
    setSavedYears(prev => [...prev, academicYear].sort((a, b) => b - a))
    setSelectedYear(academicYear)
    setTimeout(() => { setSavedFlash(false); setTab('history') }, 1500)
  }

  // history grouped by classroom for selected year
  const historyForYear = history.filter(r => r.academic_year === selectedYear)
  const histByClass = new Map<string, GradeHistoryRow[]>()
  historyForYear.forEach(r => {
    if (!histByClass.has(r.classroom_name)) histByClass.set(r.classroom_name, [])
    histByClass.get(r.classroom_name)!.push(r)
  })
  const histClassrooms = Array.from(histByClass.keys()).sort()

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
  }

  return (
    <div className="space-y-5 pb-10">
      <Link href="/admin/manage" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> ระบบหลังบ้าน
      </Link>

      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <GraduationCap size={22} className="text-blue-600" /> เลื่อนชั้น / ประวัติรายปีการศึกษา
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          บันทึกสถานะนักเรียนสิ้นปีการศึกษา เพื่อดูพัฒนาการย้อนหลังในอนาคต
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {([
          { key: 'snapshot', label: 'บันทึกสิ้นปีการศึกษา', icon: <CalendarDays size={15} /> },
          { key: 'history', label: `ประวัติย้อนหลัง (${savedYears.length} ปี)`, icon: <History size={15} /> },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ─── Tab: Snapshot ─── */}
      {tab === 'snapshot' && (
        <div className="space-y-4">
          {/* Current state summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-blue-700">{students.length}</p>
              <p className="text-xs text-blue-500 mt-0.5">นักเรียนปัจจุบัน</p>
            </div>
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-indigo-700">{classroomNames.length}</p>
              <p className="text-xs text-indigo-500 mt-0.5">ห้องเรียนที่มีข้อมูล</p>
            </div>
          </div>

          {/* Academic year input */}
          <div className="bg-white border border-gray-200 rounded-2xl px-4 py-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <CalendarDays size={16} className="text-blue-500" /> ระบุปีการศึกษาที่ต้องการบันทึก
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={academicYear}
                onChange={e => setAcademicYear(Number(e.target.value))}
                className="w-32 text-lg font-bold border border-gray-300 rounded-xl px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <span className="text-sm text-gray-500">(พ.ศ. / เช่น 2569)</span>
            </div>
            {alreadySaved && (
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs">
                <AlertTriangle size={13} /> บันทึกปีการศึกษา {academicYear} ไปแล้ว
              </div>
            )}
          </div>

          {/* Preview toggle */}
          <button
            onClick={() => setShowPreview(v => !v)}
            className="w-full flex items-center justify-between bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-2xl px-4 py-3 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Users size={15} className="text-gray-500" /> ตัวอย่างข้อมูลที่จะบันทึก
            </span>
            <ChevronDown size={16} className={`text-gray-400 transition-transform ${showPreview ? 'rotate-180' : ''}`} />
          </button>

          {showPreview && (
            <div className="space-y-2">
              {classroomNames.map(cn => {
                const sts = byClassroom.get(cn) ?? []
                const grade = extractGrade(cn)
                const next = nextGrade(grade)
                return (
                  <div key={cn} className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-semibold text-gray-800">{cn}</span>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{grade}</span>
                        <ArrowRight size={12} />
                        <span className={`px-2 py-0.5 rounded-full font-medium ${next ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {next ?? 'จบ ป.6'}
                        </span>
                        <span className="ml-1 text-gray-400">{sts.length} คน</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 truncate">
                      {sts.slice(0, 5).map(s => s.name).join(', ')}{sts.length > 5 ? ` +${sts.length - 5} คน` : ''}
                    </p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Save button */}
          <button
            onClick={saveSnapshot}
            disabled={saving || alreadySaved || students.length === 0}
            className={`w-full text-white text-sm font-semibold py-3.5 rounded-2xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
              savedFlash ? 'bg-green-500' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> กำลังบันทึก…</>
              : savedFlash ? <><CheckCircle2 size={16} /> บันทึกสำเร็จ!</>
              : <><GraduationCap size={16} /> บันทึกสถานะนักเรียนปีการศึกษา {academicYear}</>}
          </button>

          {students.length === 0 && (
            <p className="text-center text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-xl py-3">
              ยังไม่มีข้อมูลนักเรียน — อัปโหลดรายชื่อก่อนครับ
            </p>
          )}
        </div>
      )}

      {/* ─── Tab: History ─── */}
      {tab === 'history' && (
        <div className="space-y-4">
          {savedYears.length === 0 ? (
            <div className="text-center py-16 text-gray-400 border border-dashed border-gray-200 rounded-2xl">
              <History size={28} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm">ยังไม่มีประวัติการเลื่อนชั้น</p>
              <p className="text-xs mt-1">กลับไปแท็บ "บันทึกสิ้นปีการศึกษา" เพื่อบันทึกครั้งแรก</p>
            </div>
          ) : (
            <>
              {/* Year selector */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-gray-500">เลือกปีการศึกษา:</span>
                {savedYears.map(y => (
                  <button
                    key={y}
                    onClick={() => setSelectedYear(y)}
                    className={`text-sm font-semibold px-4 py-1.5 rounded-full border transition-colors ${
                      selectedYear === y
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>

              {selectedYear && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-700">
                      ปีการศึกษา {selectedYear} — {historyForYear.length} คน ใน {histClassrooms.length} ห้อง
                    </p>
                  </div>
                  <div className="space-y-3">
                    {histClassrooms.map(cn => {
                      const list = histByClass.get(cn) ?? []
                      const grade = list[0]?.grade_level ?? extractGrade(cn)
                      const next = nextGrade(grade)
                      return (
                        <div key={cn} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                          <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between border-b border-gray-100">
                            <span className="text-sm font-bold text-gray-800">{cn}</span>
                            <div className="flex items-center gap-1 text-xs">
                              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{grade}</span>
                              <ArrowRight size={11} className="text-gray-400" />
                              <span className={`px-2 py-0.5 rounded-full font-medium ${next ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {next ?? 'จบ ป.6'}
                              </span>
                              <span className="ml-1 text-gray-400">{list.length} คน</span>
                            </div>
                          </div>
                          <div className="px-4 py-2 divide-y divide-gray-50">
                            {list.map(r => (
                              <div key={r.id} className="py-1.5 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {r.student_number && (
                                    <span className="text-[10px] text-gray-400 font-mono w-6">{r.student_number}</span>
                                  )}
                                  <span className="text-sm text-gray-700">{r.student_name}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
