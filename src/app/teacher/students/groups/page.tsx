'use client'

// จัดกลุ่มนักเรียนตามความสามารถ — ใช้คะแนนสะสมทั้งหมด (ไม่จำกัดตามเทอม เพราะจุดประสงค์คือ
// ทบทวนภาพรวมย้อนหลังหลายเดือน) แบ่งนักเรียนแต่ละห้อง/วิชาเป็น 3 กลุ่ม: เก่ง/ปานกลาง/ควรดูแล
// สองแหล่งข้อมูลให้เลือก: (1) คะแนนรายคาบ/exit ticket ประจำวัน ผูกกับ academic_tags ของหน่วยการเรียนรู้
// (2) ผลสอบจริง ผูกกับตัวชี้วัด — ครูสร้างข้อสอบจากตัวชี้วัดแล้วตรวจให้คะแนนรายข้อ ซึ่งแม่นกว่าเพราะ
// วัดตรงเป็นรายข้อ ไม่ใช่คะแนนรวมทั้งฉบับเฉลี่ยลงทุกตัวชี้วัดเท่ากัน

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Student, StudentAssessment, CurriculumModule, Course, Test, TestItem, TestScore, TestItemResponse, Indicator,
} from '@/lib/types'
import {
  groupStudentsByAbility, weakStudentsByTag, groupStudentsByIndicatorAbility, weakStudentsByIndicator,
  StudentAbility,
} from '@/lib/analytics'
import { fetchAllPaged, latestAssessmentPerPlan } from '@/lib/db'
import { getSchoolId } from '@/lib/school'
import { getSession } from '@/lib/auth'
import { RoomFilter, readStoredRoom, storeRoom } from '@/components/room-filter'
import { Loader2, Users2, Gauge, ClipboardCheck, NotebookPen } from 'lucide-react'

type DataSource = 'tag' | 'indicator'

const TIER_CFG = {
  strong: { label: 'เก่ง', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-700' },
  medium: { label: 'ปานกลาง', bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700' },
  weak: { label: 'ควรดูแล', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
} as const

export default function StudentGroupsPage() {
  const supabase = createClient()
  const schoolId = getSchoolId()
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<Student[]>([])
  const [modules, setModules] = useState<CurriculumModule[]>([])
  const [assessments, setAssessments] = useState<StudentAssessment[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [tests, setTests] = useState<Test[]>([])
  const [testItems, setTestItems] = useState<TestItem[]>([])
  const [testScores, setTestScores] = useState<TestScore[]>([])
  const [testItemResponses, setTestItemResponses] = useState<TestItemResponse[]>([])
  const [indicators, setIndicators] = useState<Indicator[]>([])
  const [boundRooms, setBoundRooms] = useState<string[]>([])
  const [teacherSubjects, setTeacherSubjects] = useState<string[]>([])
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [selectedSubject, setSelectedSubject] = useState('')
  const [source, setSource] = useState<DataSource>('tag')

  useEffect(() => {
    async function load() {
      const session = getSession()
      const [
        { data: stds }, { data: mods }, asm, { data: crs },
        { data: tst }, its, tsc, resp, { data: inds },
      ] = await Promise.all([
        supabase.from('students').select('*').eq('school_id', schoolId).order('student_number'),
        supabase.from('curriculum_modules').select('*').eq('school_id', schoolId),
        fetchAllPaged<StudentAssessment>(() => supabase.from('student_assessments').select('*').eq('school_id', schoolId).order('id')),
        supabase.from('courses').select('*').eq('school_id', schoolId),
        supabase.from('tests').select('*').eq('school_id', schoolId),
        fetchAllPaged<TestItem>(() => supabase.from('test_items').select('*').order('test_id').order('item_no')),
        fetchAllPaged<TestScore>(() => supabase.from('test_scores').select('*').eq('school_id', schoolId).order('id')),
        fetchAllPaged<TestItemResponse>(() => supabase.from('test_item_responses').select('*').eq('school_id', schoolId).order('id')),
        supabase.from('indicators').select('id, subject, code, description'),
      ])
      setStudents((stds ?? []) as Student[])
      setModules((mods ?? []) as CurriculumModule[])
      setAssessments(latestAssessmentPerPlan(asm))
      setCourses((crs ?? []) as Course[])
      setTests((tst ?? []) as Test[])
      setTestItems(its)
      setTestScores(tsc)
      setTestItemResponses(resp)
      setIndicators((inds ?? []) as Indicator[])

      // เฉพาะครู: ย่อห้อง/วิชาเหลือแค่ของตัวเอง (ไม่ผูก = เห็นทุกห้อง/วิชา เหมือนหน้าอื่นๆ)
      if (session?.role === 'teacher' && session.userId) {
        const [{ data: links }, { data: teacherRow }] = await Promise.all([
          supabase.from('teacher_classrooms').select('classrooms(name)').eq('teacher_id', session.userId),
          supabase.from('teachers').select('subjects').eq('id', session.userId).maybeSingle(),
        ])
        const names = (links ?? [])
          .map((r: { classrooms: { name: string } | { name: string }[] | null }) =>
            Array.isArray(r.classrooms) ? r.classrooms[0]?.name : r.classrooms?.name)
          .filter(Boolean) as string[]
        setBoundRooms(names)
        setTeacherSubjects(teacherRow?.subjects ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  const roomOptions = useMemo(() => {
    const all = Array.from(new Set(students.map(s => s.class_name).filter(Boolean))).sort()
    return boundRooms.length > 0 ? all.filter(r => boundRooms.includes(r)) : all
  }, [students, boundRooms])
  useEffect(() => {
    if (roomOptions.length === 0) return
    setSelectedRoom(prev => (prev && roomOptions.includes(prev)) ? prev : readStoredRoom(roomOptions))
  }, [roomOptions.join(',')])

  const subjects = useMemo(() => {
    const all = Array.from(new Set([...modules.map(m => m.subject), ...tests.map(t => t.subject)])).sort()
    return teacherSubjects.length > 0 ? all.filter(s => teacherSubjects.includes(s)) : all
  }, [modules, tests, teacherSubjects])
  useEffect(() => {
    if (subjects.length && !subjects.includes(selectedSubject)) setSelectedSubject(subjects[0])
  }, [subjects.join(',')])

  const courseName = (key: string) => courses.find(c => c.subject_key === key)?.name ?? key.replace('_', ' ')

  const visibleStudents = useMemo(() => {
    // "ทุกห้อง" ของครูที่ผูกห้องไว้ ต้องหมายถึงทุกห้องของครูคนนั้น ไม่ใช่ทั้งโรงเรียน
    if (selectedRoom) return students.filter(s => s.class_name === selectedRoom)
    return boundRooms.length > 0 ? students.filter(s => boundRooms.includes(s.class_name)) : students
  }, [students, selectedRoom, boundRooms])

  const subjectModules = useMemo(
    () => modules.filter(m => m.subject === selectedSubject),
    [modules, selectedSubject]
  )
  const subjectModuleIds = useMemo(() => new Set(subjectModules.map(m => m.id)), [subjectModules])
  const subjectTests = useMemo(
    () => tests.filter(t => t.subject === selectedSubject),
    [tests, selectedSubject]
  )

  const tagTiers = useMemo(
    () => groupStudentsByAbility(visibleStudents, assessments, subjectModuleIds),
    [visibleStudents, assessments, subjectModuleIds]
  )
  const indicatorTiers = useMemo(
    () => groupStudentsByIndicatorAbility(visibleStudents, subjectTests, testItems, testScores, testItemResponses),
    [visibleStudents, subjectTests, testItems, testScores, testItemResponses]
  )
  const tiers = source === 'tag' ? tagTiers : indicatorTiers
  const noData = visibleStudents.length - tiers.length

  const weakTags = useMemo(
    () => weakStudentsByTag(visibleStudents, assessments, subjectModules),
    [visibleStudents, assessments, subjectModules]
  )
  const weakIndicators = useMemo(
    () => weakStudentsByIndicator(visibleStudents, subjectTests, testItems, testScores, testItemResponses),
    [visibleStudents, subjectTests, testItems, testScores, testItemResponses]
  )
  const weakList = source === 'tag' ? weakTags : weakIndicators

  const indicatorLabel = (code: string) =>
    indicators.find(i => i.subject === selectedSubject && i.code === code)?.description
    ?? indicators.find(i => i.code === code)?.description ?? ''

  const byTier = (tier: StudentAbility['tier']) => tiers.filter(t => t.tier === tier)

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
  }

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Users2 size={20} className="text-blue-600" /> จัดกลุ่มนักเรียนตามความสามารถ
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          สรุปจากคะแนนสะสมทั้งหมด (ไม่จำกัดเทอม) — ใช้ทบทวนหลังผ่านไปหลายเดือนว่าใครต้องปรับกลุ่ม/ปรับแผน
        </p>
      </div>

      <RoomFilter rooms={roomOptions} value={selectedRoom} onChange={r => { setSelectedRoom(r); storeRoom(r) }} />

      {/* แหล่งข้อมูล: คะแนนรายคาบประจำวัน (academic_tags) vs ผลสอบจริงรายข้อ (ตัวชี้วัด) */}
      <div className="flex gap-1.5 bg-gray-100 rounded-2xl p-1">
        <button onClick={() => setSource('tag')}
          className={`flex-1 text-xs font-semibold py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            source === 'tag' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
          }`}>
          <NotebookPen size={13} /> คะแนนรายคาบ
        </button>
        <button onClick={() => setSource('indicator')}
          className={`flex-1 text-xs font-semibold py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            source === 'indicator' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
          }`}>
          <ClipboardCheck size={13} /> ผลสอบจริง (รายข้อ)
        </button>
      </div>

      {subjects.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {subjects.map(s => (
            <button key={s} onClick={() => setSelectedSubject(s)}
              className={`flex-shrink-0 text-xs font-bold px-3.5 py-2 rounded-xl border ${
                selectedSubject === s ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-500'
              }`}>
              {courseName(s)}
            </button>
          ))}
        </div>
      )}

      {tiers.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-12 border border-dashed border-gray-200 rounded-2xl">
          {source === 'tag'
            ? `ยังไม่มีข้อมูลการประเมินรายคาบในวิชานี้${selectedRoom ? `สำหรับห้อง ${selectedRoom}` : ''}`
            : `ยังไม่มีข้อสอบที่ตรวจแล้วในวิชานี้${selectedRoom ? `สำหรับห้อง ${selectedRoom}` : ''} — ต้องผูกตัวชี้วัดกับข้อสอบและตรวจให้คะแนนรายข้อก่อน`}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {(['strong', 'medium', 'weak'] as const).map(tier => {
              const cfg = TIER_CFG[tier]
              const list = byTier(tier)
              return (
                <div key={tier} className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-2.5`}>
                  <p className={`text-xs font-bold ${cfg.text} mb-1.5 text-center`}>{cfg.label} ({list.length})</p>
                  <div className="space-y-1">
                    {list.map(a => (
                      <Link key={a.student.id} href={`/teacher/students/${a.student.id}`}
                        className="flex items-center justify-between bg-white/70 hover:bg-white rounded-lg px-2 py-1.5">
                        <span className="text-[11px] font-medium text-gray-700 truncate">{a.student.name}</span>
                        <span className={`text-[10px] font-bold px-1 rounded ${cfg.badge} flex-shrink-0`}>{a.avgScore.toFixed(1)}</span>
                      </Link>
                    ))}
                    {list.length === 0 && <p className="text-[10px] text-gray-300 text-center py-2">—</p>}
                  </div>
                </div>
              )
            })}
          </div>
          {noData > 0 && (
            <p className="text-[11px] text-gray-400 text-center">
              อีก {noData} คนยังไม่มีข้อมูลประเมินในวิชานี้
            </p>
          )}

          {weakList.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
              <p className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                <Gauge size={15} className="text-orange-500" />
                {source === 'tag' ? 'จุดอ่อนรายมาตรฐาน (จากรายคาบ) — ใครยังไม่ผ่านเรื่องไหน' : 'จุดอ่อนรายตัวชี้วัด (จากผลสอบจริง) — ใครยังไม่ผ่านข้อไหน'}
              </p>
              {weakList.map(({ tag, weakest }) => (
                <div key={tag} className="space-y-1">
                  <p className="text-xs font-semibold text-gray-600">
                    {tag}
                    {source === 'indicator' && indicatorLabel(tag) && (
                      <span className="text-[10px] font-normal text-gray-400"> — {indicatorLabel(tag)}</span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {weakest.map(w => (
                      <Link key={w.student.id} href={`/teacher/students/${w.student.id}`}
                        className="flex items-center gap-1 text-[11px] bg-orange-50 text-orange-700 border border-orange-100 rounded-full px-2 py-1 hover:bg-orange-100">
                        {w.student.name}
                        <span className="font-bold">{w.avgScore.toFixed(1)}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Link href="/teacher/remediation"
            className="block text-center text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl py-2.5 hover:bg-rose-100">
            💗 ไปสร้างแผนซ่อมเสริมรายบุคคล →
          </Link>
        </>
      )}
    </div>
  )
}
