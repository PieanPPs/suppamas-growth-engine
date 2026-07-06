'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Student, Course, Test, TestScore, StudentAssessment, CurriculumModule,
  ScoreComponent, ComponentScore, Classroom, TraitRating, AttendanceRecord,
} from '@/lib/types'
import { buildPp5Row, PHASE_LABEL, Pp5Row } from '@/lib/pp5'
import { TRAIT_ITEMS, LEVEL_LABELS } from '@/lib/traits'
import { Loader2, Printer, ArrowLeft } from 'lucide-react'
import { getSchoolId } from '@/lib/school'
import { fetchAllPaged, latestAssessmentPerPlan } from '@/lib/db'

export default function Pp5PrintPage() {
  const supabase = createClient()
  const schoolId = getSchoolId()
  const [loading, setLoading] = useState(true)
  const [subject, setSubject] = useState('')
  const [room, setRoom] = useState('')
  const [course, setCourse] = useState<Course | null>(null)
  const [classroom, setClassroom] = useState<Classroom | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [components, setComponents] = useState<ScoreComponent[]>([])
  const [rows, setRows] = useState<Pp5Row[]>([])
  const [traits, setTraits] = useState<TraitRating[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [teachingDays, setTeachingDays] = useState(0)

  useEffect(() => {
    async function load() {
      const params = new URLSearchParams(window.location.search)
      const subj = params.get('subject') ?? ''
      const rm = params.get('room') ?? ''
      setSubject(subj); setRoom(rm)

      const [
        { data: crs }, { data: stds }, { data: comps }, cs,
        { data: tst }, tsc, asm, { data: mods }, { data: cls }, tr, att,
      ] = await Promise.all([
        supabase.from('courses').select('*').eq('school_id', schoolId).eq('subject_key', subj).single(),
        supabase.from('students').select('*').eq('school_id', schoolId).order('student_number'),
        supabase.from('score_components').select('*').eq('school_id', schoolId).eq('subject', subj).order('sequence_order'),
        fetchAllPaged<ComponentScore>(() => supabase.from('component_scores').select('*').order('id')),
        supabase.from('tests').select('*').eq('school_id', schoolId),
        fetchAllPaged<TestScore>(() => supabase.from('test_scores').select('*').eq('school_id', schoolId).order('id')),
        fetchAllPaged<StudentAssessment>(() => supabase.from('student_assessments').select('*').eq('school_id', schoolId).order('id')),
        supabase.from('curriculum_modules').select('id, subject').eq('school_id', schoolId),
        rm ? supabase.from('classrooms').select('*').eq('school_id', schoolId).eq('name', rm).single() : Promise.resolve({ data: null }),
        fetchAllPaged<TraitRating>(() => supabase.from('trait_ratings').select('*').eq('school_id', schoolId).eq('subject', subj).order('id')),
        fetchAllPaged<AttendanceRecord>(() => supabase.from('attendance').select('*').eq('school_id', schoolId).order('id')),
      ])

      setTraits(tr)
      setAttendance(att)
      // วันเรียนโดยประมาณ = จำนวนวันที่มีการประเมินใด ๆ ในระบบ (แนวเดียวกับ ปพ.6)
      setTeachingDays(new Set(((asm ?? []) as StudentAssessment[]).map(a => a.created_at.slice(0, 10))).size)
      setCourse(crs)
      setClassroom(cls as Classroom | null)
      const list = ((stds ?? []) as Student[]).filter(s => !rm || s.class_name === rm)
      setStudents(list)
      const compList = (comps ?? []) as ScoreComponent[]
      setComponents(compList)

      const manualMap = new Map<string, number>()
      ;((cs ?? []) as ComponentScore[]).forEach(c => manualMap.set(`${c.component_id}_${c.student_id}`, c.score))
      const moduleSubject = new Map(((mods ?? []) as CurriculumModule[]).map(m => [m.id, m.subject]))

      setRows(list.map(s => buildPp5Row(
        s.id, compList, manualMap,
        (tst ?? []) as Test[], (tsc ?? []) as TestScore[],
        latestAssessmentPerPlan((asm ?? []) as StudentAssessment[]), moduleSubject
      )))
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-gray-500" size={32} /></div>
  }

  const totalMax = components.reduce((s, c) => s + c.max_score, 0)
  const collectMax = components.filter(c => c.phase === 'before_mid' || c.phase === 'after_mid').reduce((s, c) => s + c.max_score, 0)
  const midtermMax = components.filter(c => c.phase === 'midterm').reduce((s, c) => s + c.max_score, 0)
  const finalMax = components.filter(c => c.phase === 'final').reduce((s, c) => s + c.max_score, 0)
  const ratio = `${collectMax + midtermMax}:${finalMax}`

  // สรุปจำนวนตามเกรด (เฉพาะที่คะแนนครบ)
  const gradeLevels = [4, 3.5, 3, 2.5, 2, 1.5, 1, 0]
  const gradeCounts = gradeLevels.map(g => rows.filter(r => r.complete && r.grade === g).length)
  const completeCount = rows.filter(r => r.complete).length

  return (
    <div className="max-w-[210mm] mx-auto">
      <div className="print:hidden flex items-center justify-between mb-4">
        <Link href="/teacher/pp5" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> ปพ.5
        </Link>
        <button onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 bg-gray-900 hover:bg-black text-white text-xs font-semibold px-4 py-2.5 rounded-xl">
          <Printer size={14} /> พิมพ์ / บันทึก PDF
        </button>
      </div>

      <div className="bg-white border border-gray-200 print:border-0 rounded-2xl print:rounded-none px-6 py-6 print:px-0 print:py-0">
        {/* header แบบฟอร์มจริง */}
        <header className="text-center space-y-0.5">
          <p className="text-[13px] font-bold text-gray-900">แบบบันทึกผลการพัฒนาคุณภาพผู้เรียน (ปพ.5) — ใบคะแนนรายวิชา</p>
          <p className="text-[12px] text-gray-800">โรงเรียนอนุสรณ์ศุภมาศ สำนักงานคณะกรรมการส่งเสริมการศึกษาเอกชน</p>
          <p className="text-[11px] text-gray-600">
            ชั้นเรียน: {room || 'ทุกห้อง'}{classroom?.homeroom_teacher ? ` / ครูประจำชั้น: ${classroom.homeroom_teacher}` : ''}
          </p>
          <p className="text-[11px] text-gray-600">
            รายวิชา: {course?.name ?? subject} / เกณฑ์ที่ใช้วัด: {ratio}
          </p>
        </header>

        {/* score table */}
        <table className="w-full text-[10px] border border-gray-400 mt-4">
          <thead>
            <tr className="bg-gray-100">
              <th rowSpan={2} className="border border-gray-400 px-1 py-1 w-7">ลำดับ</th>
              <th rowSpan={2} className="border border-gray-400 px-1 py-1 w-14">เลขประจำตัว</th>
              <th rowSpan={2} className="border border-gray-400 px-2 py-1 text-left min-w-[120px]">ชื่อ-สกุล</th>
              {(['before_mid', 'midterm', 'after_mid', 'final'] as const).map(phase => {
                const cols = components.filter(c => c.phase === phase)
                if (cols.length === 0) return null
                return <th key={phase} colSpan={cols.length} className="border border-gray-400 px-1 py-1">{PHASE_LABEL[phase]}</th>
              })}
              <th rowSpan={2} className="border border-gray-400 px-1 py-1">เก็บ<br />({collectMax})</th>
              <th rowSpan={2} className="border border-gray-400 px-1 py-1">รวม<br />({totalMax})</th>
              <th rowSpan={2} className="border border-gray-400 px-1 py-1">ผลการเรียน</th>
            </tr>
            <tr className="bg-gray-50">
              {(['before_mid', 'midterm', 'after_mid', 'final'] as const).flatMap(phase =>
                components.filter(c => c.phase === phase).map(c => (
                  <th key={c.id} className="border border-gray-400 px-1 py-1 font-medium">
                    {c.name}<br />({c.max_score})
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => {
              const row = rows[i]
              const orderedCells = (['before_mid', 'midterm', 'after_mid', 'final'] as const).flatMap(phase =>
                components.map((c, ci) => ({ c, cell: row.cells[ci] })).filter(x => x.c.phase === phase)
              )
              return (
                <tr key={s.id}>
                  <td className="border border-gray-400 px-1 py-0.5 text-center">{i + 1}</td>
                  <td className="border border-gray-400 px-1 py-0.5 text-center">{s.student_number ?? ''}</td>
                  <td className="border border-gray-400 px-2 py-0.5">{s.name}</td>
                  {orderedCells.map(({ c, cell }) => (
                    <td key={c.id} className="border border-gray-400 px-1 py-0.5 text-center">{cell.value ?? ''}</td>
                  ))}
                  <td className="border border-gray-400 px-1 py-0.5 text-center font-semibold">{row.collectTotal}</td>
                  <td className="border border-gray-400 px-1 py-0.5 text-center font-semibold">{row.total}</td>
                  <td className="border border-gray-400 px-1 py-0.5 text-center font-bold">{row.complete ? row.grade : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* grade summary */}
        <table className="w-full text-[10px] border border-gray-400 mt-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 px-2 py-1 text-left" colSpan={2}>สรุปผลการเรียน</th>
              {gradeLevels.map(g => <th key={g} className="border border-gray-400 px-2 py-1">{g}</th>)}
              <th className="border border-gray-400 px-2 py-1">รวม</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-400 px-2 py-1" colSpan={2}>จำนวนนักเรียนที่ได้ระดับผลการเรียน</td>
              {gradeCounts.map((n, i) => <td key={i} className="border border-gray-400 px-2 py-1 text-center">{n || ''}</td>)}
              <td className="border border-gray-400 px-2 py-1 text-center font-semibold">{completeCount}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 px-2 py-1" colSpan={2}>ร้อยละ</td>
              {gradeCounts.map((n, i) => (
                <td key={i} className="border border-gray-400 px-2 py-1 text-center">
                  {completeCount > 0 && n > 0 ? ((n / completeCount) * 100).toFixed(1) : ''}
                </td>
              ))}
              <td className="border border-gray-400 px-2 py-1 text-center">100</td>
            </tr>
          </tbody>
        </table>

        {/* attendance summary — สรุปเวลาเรียนตามแบบ ปพ.5 (เกณฑ์เข้าเรียนไม่น้อยกว่า 80%) */}
        {teachingDays > 0 && (
          <>
            <h3 className="text-[11px] font-bold text-gray-900 mt-4">
              สรุปเวลาเรียน (วันเรียนที่บันทึกในระบบ {teachingDays} วัน · เกณฑ์เข้าเรียนไม่น้อยกว่า 80%)
            </h3>
            <table className="w-full text-[10px] border border-gray-400 mt-1.5">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 px-1 py-1 w-7">ลำดับ</th>
                  <th className="border border-gray-400 px-2 py-1 text-left min-w-[120px]">ชื่อ-สกุล</th>
                  <th className="border border-gray-400 px-1 py-1 w-12">ป่วย</th>
                  <th className="border border-gray-400 px-1 py-1 w-12">ลา</th>
                  <th className="border border-gray-400 px-1 py-1 w-12">ขาด</th>
                  <th className="border border-gray-400 px-1 py-1 w-12">สาย</th>
                  <th className="border border-gray-400 px-1 py-1 w-16">มาเรียน (วัน)</th>
                  <th className="border border-gray-400 px-1 py-1 w-16">ร้อยละ</th>
                  <th className="border border-gray-400 px-1 py-1 w-20">ผลการประเมิน</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => {
                  const mine = attendance.filter(a => a.student_id === s.id)
                  const cnt = (st: string) => mine.filter(a => a.status === st).length
                  const missed = Math.min(teachingDays, cnt('absent') + cnt('sick') + cnt('leave'))
                  const present = teachingDays - missed
                  const pct = Math.round((present / teachingDays) * 100)
                  return (
                    <tr key={s.id}>
                      <td className="border border-gray-400 px-1 py-0.5 text-center">{i + 1}</td>
                      <td className="border border-gray-400 px-2 py-0.5">{s.name}</td>
                      <td className="border border-gray-400 px-1 py-0.5 text-center">{cnt('sick') || ''}</td>
                      <td className="border border-gray-400 px-1 py-0.5 text-center">{cnt('leave') || ''}</td>
                      <td className="border border-gray-400 px-1 py-0.5 text-center">{cnt('absent') || ''}</td>
                      <td className="border border-gray-400 px-1 py-0.5 text-center">{cnt('late') || ''}</td>
                      <td className="border border-gray-400 px-1 py-0.5 text-center">{present}</td>
                      <td className="border border-gray-400 px-1 py-0.5 text-center font-semibold">{pct}</td>
                      <td className={`border border-gray-400 px-1 py-0.5 text-center font-bold ${pct < 80 ? 'text-red-600' : ''}`}>
                        {pct >= 80 ? 'ผ่าน' : 'ไม่ผ่าน (มส.)'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}

        {/* ===== หน้า 2: คุณลักษณะอันพึงประสงค์ + อ่านคิดวิเคราะห์เขียน ===== */}
        {traits.length > 0 && (
          <section className="break-before-page pt-6">
            <h2 className="text-[13px] font-bold text-gray-900 text-center">
              รายงานคุณลักษณะอันพึงประสงค์ และการอ่าน คิดวิเคราะห์ และเขียน
            </h2>
            <p className="text-[11px] text-gray-600 text-center mt-0.5">
              ชั้นเรียน: {room || 'ทุกห้อง'} / รายวิชา: {course?.name ?? subject}
            </p>
            <table className="w-full text-[9.5px] border border-gray-400 mt-3">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 px-1 py-1 w-7">ลำดับ</th>
                  <th className="border border-gray-400 px-2 py-1 text-left min-w-[110px]">ชื่อ-สกุล</th>
                  {TRAIT_ITEMS.map(item => (
                    <th key={item.no} className="border border-gray-400 px-1 py-1" title={item.name}>ข้อ {item.no}</th>
                  ))}
                  <th className="border border-gray-400 px-1 py-1">สรุปคุณลักษณะ</th>
                  <th className="border border-gray-400 px-1 py-1">อ่านคิดฯ เขียน</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => {
                  const mine = traits.filter(t => t.student_id === s.id)
                  const traitOf = (no: number) => mine.find(t => t.kind === 'trait' && t.item_no === no)?.level
                  const rwa = mine.find(t => t.kind === 'rwa')?.level
                  const levels = TRAIT_ITEMS.map(it => traitOf(it.no)).filter(v => v != null) as number[]
                  const summary = levels.length === TRAIT_ITEMS.length
                    ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length)
                    : null
                  return (
                    <tr key={s.id}>
                      <td className="border border-gray-400 px-1 py-0.5 text-center">{i + 1}</td>
                      <td className="border border-gray-400 px-2 py-0.5">{s.name}</td>
                      {TRAIT_ITEMS.map(item => (
                        <td key={item.no} className="border border-gray-400 px-1 py-0.5 text-center">
                          {traitOf(item.no) != null ? LEVEL_LABELS[traitOf(item.no)!] : ''}
                        </td>
                      ))}
                      <td className="border border-gray-400 px-1 py-0.5 text-center font-semibold">
                        {summary != null ? LEVEL_LABELS[summary] : ''}
                      </td>
                      <td className="border border-gray-400 px-1 py-0.5 text-center font-semibold">
                        {rwa != null ? LEVEL_LABELS[rwa] : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="text-[8.5px] text-gray-400 mt-1">
              ข้อ 1 รักชาติ ศาสน์ กษัตริย์ · ข้อ 2 ซื่อสัตย์สุจริต · ข้อ 3 มีวินัย · ข้อ 4 ใฝ่เรียนรู้ · ข้อ 5 อยู่อย่างพอเพียง · ข้อ 6 มุ่งมั่นในการทำงาน · ข้อ 7 รักความเป็นไทย · ข้อ 8 มีจิตสาธารณะ
            </p>
          </section>
        )}

        {/* approval chain */}
        <div className="grid grid-cols-2 gap-x-10 gap-y-8 mt-8 text-[11px] text-gray-800 break-inside-avoid">
          {[
            'ครูผู้สอน',
            'หัวหน้ากลุ่มสาระการเรียนรู้',
            'หัวหน้าฝ่ายวิชาการ',
            'ผู้อำนวยการ',
          ].map(role => (
            <div key={role} className="text-center">
              <p>ลงชื่อ ..............................................</p>
              <p className="mt-1">( .............................................. )</p>
              <p className="mt-1 text-gray-500">{role}</p>
            </div>
          ))}
        </div>

        <p className="text-[9px] text-gray-400 text-center mt-6">
          สร้างโดย Suppamas Growth Engine · ข้อมูล ณ {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })} · ทุกคะแนนตรวจสอบย้อนกลับได้ในระบบ
        </p>
      </div>
    </div>
  )
}
