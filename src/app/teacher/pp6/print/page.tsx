'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Student, Course, Test, TestScore, StudentAssessment, CurriculumModule,
  ScoreComponent, ComponentScore, Classroom, TraitRating, AttendanceRecord,
  HomeworkSubmission, AcademicSettings,
} from '@/lib/types'
import { buildPp5Row } from '@/lib/pp5'
import { TRAIT_ITEMS, LEVEL_LABELS } from '@/lib/traits'
import { buildStudentTagScores } from '@/lib/analytics'
import { Loader2, Printer, ArrowLeft } from 'lucide-react'
import { getSchoolId } from '@/lib/school'
import { fetchAllPaged } from '@/lib/db'

export default function Pp6PrintPage() {
  const supabase = createClient()
  const schoolId = getSchoolId()
  const [loading, setLoading] = useState(true)
  const [room, setRoom] = useState('')
  const [rooms, setRooms] = useState<string[]>([])
  const [classroom, setClassroom] = useState<Classroom | null>(null)
  const [settings, setSettings] = useState<AcademicSettings | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [components, setComponents] = useState<ScoreComponent[]>([])
  const [componentScores, setComponentScores] = useState<ComponentScore[]>([])
  const [tests, setTests] = useState<Test[]>([])
  const [testScores, setTestScores] = useState<TestScore[]>([])
  const [assessments, setAssessments] = useState<StudentAssessment[]>([])
  const [modules, setModules] = useState<CurriculumModule[]>([])
  const [homework, setHomework] = useState<HomeworkSubmission[]>([])
  const [traits, setTraits] = useState<TraitRating[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])

  useEffect(() => {
    async function load() {
      const params = new URLSearchParams(window.location.search)
      const [
        { data: stds }, { data: crs }, { data: comps }, cs,
        { data: tst }, tsc, asm, { data: mods },
        hw, tr, att, { data: st },
      ] = await Promise.all([
        supabase.from('students').select('*').eq('school_id', schoolId).order('student_number'),
        supabase.from('courses').select('*').eq('school_id', schoolId).order('name'),
        supabase.from('score_components').select('*').eq('school_id', schoolId).order('sequence_order'),
        fetchAllPaged<ComponentScore>(() => supabase.from('component_scores').select('*').order('id')),
        supabase.from('tests').select('*').eq('school_id', schoolId),
        fetchAllPaged<TestScore>(() => supabase.from('test_scores').select('*').eq('school_id', schoolId).order('id')),
        fetchAllPaged<StudentAssessment>(() => supabase.from('student_assessments').select('*').eq('school_id', schoolId).order('id')),
        supabase.from('curriculum_modules').select('*').eq('school_id', schoolId),
        fetchAllPaged<HomeworkSubmission>(() => supabase.from('homework_submissions').select('*').eq('school_id', schoolId).order('id')),
        fetchAllPaged<TraitRating>(() => supabase.from('trait_ratings').select('*').eq('school_id', schoolId).order('id')),
        fetchAllPaged<AttendanceRecord>(() => supabase.from('attendance').select('*').eq('school_id', schoolId).order('id')),
        supabase.from('academic_settings').select('*').eq('school_id', schoolId).maybeSingle(),
      ])
      const allStudents = (stds ?? []) as Student[]
      const roomList = Array.from(new Set(allStudents.map(s => s.class_name).filter(Boolean))).sort()
      setRooms(roomList)
      const wanted = params.get('room')
      const rm = wanted && roomList.includes(wanted) ? wanted : roomList[0] ?? ''
      setRoom(rm)

      setStudents(allStudents)
      setCourses(crs ?? []); setComponents(comps ?? []); setComponentScores(cs)
      setTests(tst ?? []); setTestScores(tsc); setAssessments(asm)
      setModules((mods ?? []) as CurriculumModule[])
      setHomework(hw); setTraits(tr); setAttendance(att)
      setSettings(st as AcademicSettings | null)

      if (rm) {
        const { data: cls } = await supabase.from('classrooms').select('*').eq('school_id', schoolId).eq('name', rm).single()
        setClassroom(cls as Classroom | null)
      }
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!room) return
    supabase.from('classrooms').select('*').eq('name', room).single()
      .then(({ data }) => setClassroom(data as Classroom | null))
  }, [room])

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-gray-500" size={32} /></div>
  }

  const roomStudents = students.filter(s => s.class_name === room)
  const subjects = Array.from(new Set(components.map(c => c.subject)))
  const moduleSubject = new Map(modules.map(m => [m.id, m.subject]))
  const moduleMap = new Map(modules.map(m => [m.id, m]))
  const courseName = (key: string) => courses.find(c => c.subject_key === key)?.name ?? key

  const manualMap = new Map<string, number>()
  componentScores.forEach(c => manualMap.set(`${c.component_id}_${c.student_id}`, c.score))

  // วันเรียนโดยประมาณ = วันที่มีการประเมินใดๆ ในระบบ
  const teachingDays = new Set(assessments.map(a => a.created_at.slice(0, 10))).size
  const today = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="max-w-[210mm] mx-auto">
      <div className="print:hidden flex items-center justify-between mb-4 gap-2">
        <Link href="/teacher/pp5" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> ปพ.5
        </Link>
        <div className="flex items-center gap-2">
          <select value={room} onChange={e => setRoom(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-2 bg-white">
            {rooms.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 bg-gray-900 hover:bg-black text-white text-xs font-semibold px-4 py-2.5 rounded-xl">
            <Printer size={14} /> พิมพ์ทั้งห้อง ({roomStudents.length} คน)
          </button>
        </div>
      </div>

      {roomStudents.map((s, si) => {
        // ---- เกรดรายวิชา ----
        const subjectRows = subjects.map(subj => {
          const comps = components.filter(c => c.subject === subj)
          const row = buildPp5Row(s.id, comps, manualMap, tests, testScores, assessments, moduleSubject)
          const totalMax = comps.reduce((sum, c) => sum + c.max_score, 0)
          return { subject: subj, totalMax, row }
        }).filter(r => r.row.cells.some(c => c.value != null))
        const gpaList = subjectRows.filter(r => r.row.complete).map(r => r.row.grade)
        const gpa = gpaList.length ? (gpaList.reduce((a, b) => a + b, 0) / gpaList.length).toFixed(2) : null

        // ---- เวลาเรียน ----
        const mine = attendance.filter(a => a.student_id === s.id)
        const cnt = (st: string) => mine.filter(a => a.status === st).length
        const missed = cnt('absent') + cnt('sick') + cnt('leave')
        const attendPct = teachingDays > 0 ? Math.round(((teachingDays - Math.min(teachingDays, missed)) / teachingDays) * 100) : null

        // ---- คุณลักษณะฯ สรุปข้ามวิชา ----
        const myTraits = traits.filter(t => t.student_id === s.id)
        const traitAvg = (no: number) => {
          const list = myTraits.filter(t => t.kind === 'trait' && t.item_no === no).map(t => t.level)
          return list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : null
        }
        const traitLevels = TRAIT_ITEMS.map(it => traitAvg(it.no))
        const traitSummary = traitLevels.every(v => v != null)
          ? Math.round((traitLevels as number[]).reduce((a, b) => a + b, 0) / traitLevels.length)
          : null
        const rwaList = myTraits.filter(t => t.kind === 'rwa').map(t => t.level)
        const rwa = rwaList.length ? Math.round(rwaList.reduce((a, b) => a + b, 0) / rwaList.length) : null

        // ---- มิติพฤติกรรม (เอกลักษณ์ของระบบ) ----
        const myAsm = assessments.filter(a => a.student_id === s.id)
        const myHw = homework.filter(h => h.student_id === s.id)
        const pct = (n: number, t: number) => t > 0 ? Math.round((n / t) * 100) : null
        const greenPct = pct(myAsm.filter(a => a.focus_color === 'Green').length, myAsm.length)
        const helpPct = pct(myAsm.filter(a => a.soft_skill_score === 2).length, myAsm.length)
        const onTimePct = pct(myHw.filter(h => h.status === 'On_Time').length, myHw.length)

        // จุดเด่น-ควรเสริม รายตัวชี้วัด
        const tagScores = buildStudentTagScores(myAsm, moduleMap)
        const sorted = [...tagScores].sort((a, b) => b.avgScore - a.avgScore)
        const strength = sorted[0]
        const weakness = sorted.length > 1 ? sorted[sorted.length - 1] : undefined

        const behaviorBar = (label: string, value: number | null, color: string) => (
          <div className="flex items-center gap-2">
            <span className="w-28 text-[10px] text-gray-600">{label}</span>
            <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
              {value != null && <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />}
            </div>
            <span className="w-9 text-right text-[10px] font-semibold text-gray-700">{value != null ? `${value}%` : '—'}</span>
          </div>
        )

        return (
          <div key={s.id}
            className={`bg-white border border-gray-200 print:border-0 rounded-2xl print:rounded-none px-7 py-7 print:px-0 print:py-0 mb-6 print:mb-0 ${si > 0 ? 'break-before-page' : ''}`}>
            {/* header */}
            <header className="text-center space-y-0.5 border-b-2 border-gray-800 pb-3">
              <p className="text-[13px] font-bold text-gray-900">รายงานผลการพัฒนาคุณภาพผู้เรียนรายบุคคล (ปพ.6)</p>
              <p className="text-[11.5px] text-gray-800">โรงเรียนอนุสรณ์ศุภมาศ สำนักงานคณะกรรมการส่งเสริมการศึกษาเอกชน</p>
              <p className="text-[10.5px] text-gray-500">{settings?.term_name ?? ''} · ข้อมูล ณ {today}</p>
            </header>

            {/* student info */}
            <div className="flex justify-between text-[11.5px] text-gray-800 mt-3">
              <span><strong>ชื่อ-สกุล:</strong> {s.name}</span>
              <span><strong>เลขประจำตัว:</strong> {s.student_number ?? '—'}</span>
              <span><strong>ชั้น:</strong> {s.class_name}</span>
            </div>
            {classroom?.homeroom_teacher && (
              <p className="text-[10.5px] text-gray-500 mt-0.5">ครูประจำชั้น: {classroom.homeroom_teacher}</p>
            )}

            {/* grades */}
            <table className="w-full text-[10.5px] border border-gray-400 mt-3">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 px-2 py-1 text-left">รายวิชา</th>
                  <th className="border border-gray-400 px-2 py-1 w-16">คะแนนเต็ม</th>
                  <th className="border border-gray-400 px-2 py-1 w-16">คะแนนที่ได้</th>
                  <th className="border border-gray-400 px-2 py-1 w-16">ผลการเรียน</th>
                </tr>
              </thead>
              <tbody>
                {subjectRows.map(r => (
                  <tr key={r.subject}>
                    <td className="border border-gray-400 px-2 py-1">{courseName(r.subject)}</td>
                    <td className="border border-gray-400 px-2 py-1 text-center">{r.totalMax}</td>
                    <td className="border border-gray-400 px-2 py-1 text-center">{r.row.total}</td>
                    <td className="border border-gray-400 px-2 py-1 text-center font-bold">{r.row.complete ? r.row.grade : '—'}</td>
                  </tr>
                ))}
                {subjectRows.length === 0 && (
                  <tr><td colSpan={4} className="border border-gray-400 px-2 py-2 text-center text-gray-400">ยังไม่มีข้อมูลคะแนน</td></tr>
                )}
                {gpa && (
                  <tr className="bg-gray-50 font-bold">
                    <td className="border border-gray-400 px-2 py-1" colSpan={3}>ผลการเรียนเฉลี่ย (GPA)</td>
                    <td className="border border-gray-400 px-2 py-1 text-center">{gpa}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* attendance + traits row */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="border border-gray-300 rounded-lg px-3 py-2">
                <p className="text-[10.5px] font-bold text-gray-800 mb-1">เวลาเรียน (โดยประมาณ)</p>
                <p className="text-[10px] text-gray-600">
                  วันเรียนที่บันทึก {teachingDays} วัน · ป่วย {cnt('sick')} · ลา {cnt('leave')} · ขาด {cnt('absent')} · สาย {cnt('late')}
                </p>
                <p className="text-[11px] font-semibold text-gray-800 mt-0.5">
                  มาเรียน {attendPct != null ? `${attendPct}%` : '—'}
                  {attendPct != null && attendPct < 80 && <span className="text-red-600"> ⚠ ต่ำกว่าเกณฑ์ 80%</span>}
                </p>
              </div>
              <div className="border border-gray-300 rounded-lg px-3 py-2">
                <p className="text-[10.5px] font-bold text-gray-800 mb-1">ผลการประเมินภาพรวม</p>
                <p className="text-[10px] text-gray-600">
                  คุณลักษณะอันพึงประสงค์: <strong>{traitSummary != null ? LEVEL_LABELS[traitSummary] : 'รอประเมิน'}</strong>
                </p>
                <p className="text-[10px] text-gray-600">
                  อ่าน คิดวิเคราะห์ และเขียน: <strong>{rwa != null ? LEVEL_LABELS[rwa] : 'รอประเมิน'}</strong>
                </p>
              </div>
            </div>

            {/* behavior dimensions — the system's signature */}
            <div className="border border-gray-300 rounded-lg px-3 py-2.5 mt-3">
              <p className="text-[10.5px] font-bold text-gray-800 mb-1.5">มิติพฤติกรรมการเรียนรู้ (จากการบันทึกรายคาบตลอดภาคเรียน)</p>
              <div className="space-y-1">
                {behaviorBar('สมาธิจดจ่อในคาบ', greenPct, 'bg-green-500')}
                {behaviorBar('ช่วยเหลือแบ่งปันเพื่อน', helpPct, 'bg-indigo-500')}
                {behaviorBar('ส่งงานตรงเวลา', onTimePct, 'bg-amber-500')}
              </div>
              {(strength || weakness) && (
                <p className="text-[10px] text-gray-600 mt-2">
                  {strength && <>จุดเด่น: <strong>{strength.tag}</strong> ({strength.avgScore.toFixed(1)}/2)</>}
                  {strength && weakness && weakness.tag !== strength.tag && <> · ควรเสริม: <strong>{weakness.tag}</strong> ({weakness.avgScore.toFixed(1)}/2)</>}
                </p>
              )}
            </div>

            {/* teacher comment */}
            <div className="mt-3 text-[10.5px] text-gray-800">
              <p className="font-bold">ความเห็นครูประจำชั้น</p>
              <p className="mt-3 border-b border-dotted border-gray-400">&nbsp;</p>
              <p className="mt-3 border-b border-dotted border-gray-400">&nbsp;</p>
            </div>

            {/* signatures */}
            <div className="grid grid-cols-3 gap-4 mt-6 text-[10px] text-gray-800">
              {['ครูประจำชั้น', 'ผู้อำนวยการ', 'ผู้ปกครอง'].map(role => (
                <div key={role} className="text-center">
                  <p>ลงชื่อ ......................................</p>
                  <p className="mt-1">( ...................................... )</p>
                  <p className="mt-0.5 text-gray-500">{role}</p>
                </div>
              ))}
            </div>

            <p className="text-[8.5px] text-gray-400 text-center mt-4">
              🚦 ไฟจราจรแห่งการเรียนรู้ · Suppamas Growth Engine — ทุกข้อมูลในรายงานนี้ตรวจสอบย้อนกลับได้ในระบบ
            </p>
          </div>
        )
      })}

      {roomStudents.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-16">ไม่มีนักเรียนในห้องที่เลือก</p>
      )}
    </div>
  )
}
