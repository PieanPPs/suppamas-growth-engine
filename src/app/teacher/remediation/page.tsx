'use client'

// แผนซ่อมเสริมรายบุคคล — เปลี่ยนจาก "รายงานว่าใครตก" เป็น "ช่วยครูแก้"
// เด็กเสี่ยง/หน่วยที่อ่อน → Prompt Kit ร่างแผนช่วยรายคน → บันทึก → ติดตามผลอัตโนมัติ
// (เทียบคะแนน exit ticket ในหน่วยที่อ่อน ก่อน/หลังเริ่มแผน)

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Student, StudentAssessment, CurriculumModule } from '@/lib/types'
import { computeAtRiskStudents, RiskWarning } from '@/lib/predictive'
import {
  computeWeakModules, avgInModules, buildRemediationPrompt,
  REMEDIATION_APPROACHES, RemediationPlan, WeakModule,
} from '@/lib/remediation'
import { fetchAllPaged, getTermStartISO, latestAssessmentPerPlan } from '@/lib/db'
import { getSchoolId } from '@/lib/school'
import { getSession } from '@/lib/auth'
import { RoomFilter, readStoredRoom, storeRoom } from '@/components/room-filter'
import {
  Loader2, HeartHandshake, X, Copy, Check, TrendingDown, TrendingUp,
  ChevronDown, ChevronUp, ClipboardPaste, CircleCheckBig, Archive,
} from 'lucide-react'

export default function RemediationPage() {
  const supabase = createClient()
  const schoolId = getSchoolId()
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<Student[]>([])
  const [modules, setModules] = useState<CurriculumModule[]>([])
  const [assessments, setAssessments] = useState<StudentAssessment[]>([])
  const [plans, setPlans] = useState<RemediationPlan[]>([])
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [creatingFor, setCreatingFor] = useState<Student | null>(null)
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [saveError, setSaveError] = useState('')

  async function load() {
    const termStart = await getTermStartISO(supabase, schoolId)
    const [{ data: st }, { data: mods }, asm, { data: pl }] = await Promise.all([
      supabase.from('students').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('curriculum_modules').select('*').eq('school_id', schoolId),
      fetchAllPaged<StudentAssessment>(() => {
        let q = supabase.from('student_assessments').select('*').eq('school_id', schoolId)
        if (termStart) q = q.gte('created_at', termStart)
        return q.order('id')
      }),
      supabase.from('remediation_plans').select('*').eq('school_id', schoolId).order('created_at', { ascending: false }),
    ])
    setStudents((st ?? []) as Student[])
    setModules((mods ?? []) as CurriculumModule[])
    setAssessments(latestAssessmentPerPlan(asm))
    setPlans((pl ?? []) as RemediationPlan[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const roomOptions = useMemo(
    () => Array.from(new Set(students.map(s => s.class_name).filter(Boolean))).sort(),
    [students]
  )
  useEffect(() => {
    if (roomOptions.length === 0) return
    setSelectedRoom(prev => (prev && roomOptions.includes(prev)) ? prev : readStoredRoom(roomOptions))
  }, [roomOptions.join(',')])

  const visibleStudents = useMemo(
    () => selectedRoom ? students.filter(s => s.class_name === selectedRoom) : students,
    [students, selectedRoom]
  )

  const warnings = useMemo(
    () => computeAtRiskStudents(visibleStudents, assessments, modules),
    [visibleStudents, assessments, modules]
  )
  const warningByStudent = useMemo(
    () => new Map(warnings.map(w => [w.student.id, w])),
    [warnings]
  )

  const activePlans = plans.filter(p => p.status === 'active')
  const activeByStudent = new Set(activePlans.map(p => p.student_id))
  const closedPlans = plans.filter(p => p.status !== 'active')

  // เด็กที่ควรได้แผน: ถูกธงเตือน หรือมีหน่วยที่อ่อน — และยังไม่มีแผน active
  const candidates = useMemo(() => {
    return visibleStudents
      .map(s => ({
        student: s,
        warning: warningByStudent.get(s.id) ?? null,
        weakModules: computeWeakModules(s.id, assessments, modules),
      }))
      .filter(c => !activeByStudent.has(c.student.id) && (c.warning || c.weakModules.length > 0))
      .sort((a, b) => (b.warning ? 1 : 0) - (a.warning ? 1 : 0))
  }, [visibleStudents, warningByStudent, assessments, modules, plans])

  const studentName = (id: string) => students.find(s => s.id === id)?.name ?? '?'
  const studentRoom = (id: string) => students.find(s => s.id === id)?.class_name ?? ''

  async function closePlan(plan: RemediationPlan, status: 'improved' | 'closed', note?: string) {
    await supabase.from('remediation_plans')
      .update({ status, closed_at: new Date().toISOString(), ...(note !== undefined ? { follow_up_note: note } : {}) })
      .eq('id', plan.id)
    load()
  }

  // ---- ติดตามผล: คะแนนเฉลี่ยในหน่วยที่อ่อน หลังวันเริ่มแผน ----
  function progressOf(plan: RemediationPlan): { now: number; count: number } | null {
    const ids = new Set(plan.weak_modules.map(w => w.id))
    const after = assessments.filter(a => a.created_at > plan.created_at)
    const r = avgInModules(plan.student_id, ids, after)
    return r ? { now: r.avg, count: r.count } : null
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-rose-500" size={32} /></div>
  }

  const visibleActivePlans = activePlans.filter(p => !selectedRoom || studentRoom(p.student_id) === selectedRoom)

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <HeartHandshake size={20} className="text-rose-500" /> แผนซ่อมเสริมรายบุคคล
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          ระบบชี้เด็กที่ต้องช่วย + หน่วยที่อ่อน → AI ช่วยร่างแผน → ติดตามผลจากการประเมินรายคาบอัตโนมัติ
        </p>
      </div>

      <RoomFilter rooms={roomOptions} value={selectedRoom}
        onChange={r => { setSelectedRoom(r); storeRoom(r) }} />

      {/* ---- แผนที่กำลังติดตาม ---- */}
      {visibleActivePlans.length > 0 && (
        <section className="space-y-2">
          <p className="text-sm font-bold text-gray-700">กำลังติดตาม ({visibleActivePlans.length})</p>
          {visibleActivePlans.map(plan => {
            const prog = progressOf(plan)
            const baseline = plan.baseline_avg != null ? Number(plan.baseline_avg) : null
            const delta = prog && baseline != null ? prog.now - baseline : null
            const open = expandedPlan === plan.id
            const startDate = new Date(plan.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
            return (
              <div key={plan.id} className="bg-white border border-gray-200 rounded-2xl px-4 py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{studentName(plan.student_id)}
                      <span className="text-xs font-normal text-gray-400"> · {studentRoom(plan.student_id)} · เริ่ม {startDate}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      เรื่องที่ซ่อม: {plan.weak_modules.map(w => w.title).join(', ') || '—'}
                    </p>
                  </div>
                  <button onClick={() => setExpandedPlan(open ? null : plan.id)}
                    className="text-gray-400 hover:text-gray-600 flex-shrink-0 p-1">
                    {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                {/* progress */}
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2 text-xs">
                  <span className="text-gray-500">ก่อนเริ่ม <strong className="text-gray-800">{baseline != null ? baseline.toFixed(1) : '—'}</strong></span>
                  <span className="text-gray-300">→</span>
                  {prog ? (
                    <span className="text-gray-500">
                      ตอนนี้ <strong className={delta != null && delta > 0 ? 'text-green-600' : delta != null && delta < 0 ? 'text-red-500' : 'text-gray-800'}>
                        {prog.now.toFixed(1)}
                      </strong> ({prog.count} ครั้งหลังเริ่มแผน)
                      {delta != null && delta > 0 && <TrendingUp size={13} className="inline ml-1 text-green-600" />}
                      {delta != null && delta < 0 && <TrendingDown size={13} className="inline ml-1 text-red-500" />}
                    </span>
                  ) : (
                    <span className="text-gray-400">ยังไม่มีการประเมินใหม่ในหน่วยที่ซ่อม — บันทึกรายคาบต่อไปตามปกติ</span>
                  )}
                </div>

                {open && (
                  <div className="space-y-2">
                    {plan.plan_text ? (
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-rose-50/50 border border-rose-100 rounded-xl px-3 py-2 max-h-64 overflow-y-auto font-sans">{plan.plan_text}</pre>
                    ) : (
                      <p className="text-xs text-gray-400">ยังไม่ได้บันทึกเนื้อหาแผน</p>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => closePlan(plan, 'improved')}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-2 rounded-xl flex items-center justify-center gap-1">
                        <CircleCheckBig size={13} /> ดีขึ้นแล้ว — ปิดแผน
                      </button>
                      <button onClick={() => closePlan(plan, 'closed')}
                        className="px-4 border border-gray-200 text-gray-500 text-xs font-semibold py-2 rounded-xl hover:bg-gray-50">
                        ปิดแผน
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </section>
      )}

      {/* ---- เด็กที่ควรได้แผน ---- */}
      <section className="space-y-2">
        <p className="text-sm font-bold text-gray-700">เด็กที่ควรได้รับแผนซ่อมเสริม ({candidates.length})</p>
        {candidates.map(({ student, warning, weakModules }) => (
          <div key={student.id} className="bg-white border border-orange-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800">{student.name}
                <span className="text-xs font-normal text-gray-400"> · {student.class_name}</span>
              </p>
              <p className="text-xs text-orange-600 mt-0.5">
                {warning && (warning.trend === 'declining' ? 'คะแนนลดลงต่อเนื่อง' : 'คะแนนต่ำต่อเนื่อง')}
                {warning && weakModules.length > 0 && ' · '}
                {weakModules.length > 0 && `ไม่ผ่านเกณฑ์ ${weakModules.length} เรื่อง`}
              </p>
            </div>
            <button onClick={() => { setCreatingFor(student); setSaveError('') }}
              className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold px-3 py-2 rounded-xl flex-shrink-0">
              สร้างแผน
            </button>
          </div>
        ))}
        {candidates.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8 border border-dashed border-gray-200 rounded-2xl">
            {selectedRoom ? `ไม่มีเด็กที่เข้าเกณฑ์ต้องซ่อมเสริมในห้อง ${selectedRoom} ตอนนี้ 🎉` : 'ไม่มีเด็กที่เข้าเกณฑ์ต้องซ่อมเสริมตอนนี้ 🎉'}
          </p>
        )}
      </section>

      {/* ---- ประวัติแผนที่ปิดแล้ว ---- */}
      {closedPlans.length > 0 && (
        <section>
          <button onClick={() => setShowHistory(v => !v)}
            className="w-full flex items-center justify-between text-sm font-semibold text-gray-500 py-2">
            <span className="flex items-center gap-1.5"><Archive size={14} /> ประวัติแผนที่ปิดแล้ว ({closedPlans.length})</span>
            {showHistory ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {showHistory && closedPlans.map(plan => (
            <div key={plan.id} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 mb-1.5 text-xs text-gray-500 flex items-center justify-between">
              <span>{studentName(plan.student_id)} · {plan.weak_modules.map(w => w.title).join(', ')}</span>
              <span className={plan.status === 'improved' ? 'text-green-600 font-semibold' : ''}>
                {plan.status === 'improved' ? '✓ ดีขึ้น' : 'ปิดแล้ว'}
              </span>
            </div>
          ))}
        </section>
      )}

      {creatingFor && (
        <CreatePlanModal
          student={creatingFor}
          warning={warningByStudent.get(creatingFor.id) ?? null}
          weakModules={computeWeakModules(creatingFor.id, assessments, modules)}
          assessments={assessments}
          saveError={saveError}
          onClose={() => setCreatingFor(null)}
          onSave={async (payload) => {
            setSaveError('')
            const session = getSession()
            const { error } = await supabase.from('remediation_plans').insert({
              school_id: schoolId,
              student_id: creatingFor.id,
              teacher_id: session?.userId ?? null,
              ...payload,
            })
            if (error) { setSaveError(`บันทึกไม่สำเร็จ: ${error.message}`); return }
            setCreatingFor(null)
            load()
          }}
        />
      )}
    </div>
  )
}

// ================= modal สร้างแผน =================

function CreatePlanModal({ student, warning, weakModules, assessments, saveError, onClose, onSave }: {
  student: Student
  warning: RiskWarning | null
  weakModules: WeakModule[]
  assessments: StudentAssessment[]
  saveError: string
  onClose: () => void
  onSave: (payload: {
    weak_modules: WeakModule[]
    weak_tags: string[]
    baseline_avg: number | null
    plan_text: string | null
  }) => Promise<void>
}) {
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set(weakModules.map(w => w.id)))
  const [duration, setDuration] = useState(2)
  const [approaches, setApproaches] = useState<Set<string>>(new Set(['worksheet']))
  const [note, setNote] = useState('')
  const [pasted, setPasted] = useState('')
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)

  const chosenModules = weakModules.filter(w => selectedModules.has(w.id))

  const prompt = useMemo(() => buildRemediationPrompt({
    grade: student.class_name,
    weakModules: chosenModules,
    weakTags: warning?.weakTags ?? [],
    recentScores: warning?.recentScores ?? [],
    trend: warning?.trend ?? null,
    durationWeeks: duration,
    approachTexts: REMEDIATION_APPROACHES.filter(a => approaches.has(a.key)).map(a => a.text),
    note,
  }), [student, chosenModules, warning, duration, approaches, note])

  async function copy() {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function toggle(set: Set<string>, key: string, apply: (s: Set<string>) => void) {
    const next = new Set(set)
    if (next.has(key)) next.delete(key); else next.add(key)
    apply(next)
  }

  async function save() {
    setSaving(true)
    const ids = new Set(chosenModules.map(w => w.id))
    const baseline = avgInModules(student.id, ids, assessments)
    await onSave({
      weak_modules: chosenModules,
      weak_tags: warning?.weakTags ?? [],
      baseline_avg: baseline ? Number(baseline.avg.toFixed(3)) : null,
      plan_text: pasted.trim() || null,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center sm:p-4">
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }}
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
            <HeartHandshake size={16} className="text-rose-500" /> แผนซ่อมเสริม — {student.name}
          </p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 text-xs text-rose-700 leading-relaxed">
            <strong>3 ขั้นตอน:</strong> ① คัดลอกพรอมต์ → วางในเว็บ AI ฟรี ② นำแผนที่ได้มาวางในช่องล่าง
            ③ กดบันทึก — ระบบจะติดตามผลจากการประเมินรายคาบให้อัตโนมัติ
            <br /><span className="text-rose-500">พรอมต์ไม่ระบุชื่อเด็ก เพื่อความเป็นส่วนตัว (PDPA)</span>
          </div>

          {weakModules.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-600">เรื่องที่จะซ่อม (แตะเพื่อเลือก/ไม่เลือก)</p>
              <div className="flex flex-wrap gap-1.5">
                {weakModules.map(w => {
                  const on = selectedModules.has(w.id)
                  return (
                    <button key={w.id} onClick={() => toggle(selectedModules, w.id, setSelectedModules)}
                      className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border ${on ? 'bg-rose-500 border-rose-500 text-white' : 'bg-white border-gray-200 text-gray-500'}`}>
                      {w.title} ({w.avg.toFixed(1)})
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold text-gray-600">ระยะเวลา</p>
            {[2, 4].map(wks => (
              <button key={wks} onClick={() => setDuration(wks)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${duration === wks ? 'bg-rose-500 border-rose-500 text-white' : 'bg-white border-gray-200 text-gray-500'}`}>
                {wks} สัปดาห์
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-600">แนวทางที่ครูอยากใช้ (เลือกได้หลายข้อ)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {REMEDIATION_APPROACHES.map(a => {
                const on = approaches.has(a.key)
                return (
                  <button key={a.key} onClick={() => toggle(approaches, a.key, setApproaches)}
                    className={`text-left rounded-xl border px-2.5 py-2 ${on ? 'border-rose-400 bg-rose-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <span className={`block text-xs font-semibold ${on ? 'text-rose-700' : 'text-gray-700'}`}>{a.label}</span>
                    <span className="block text-[10px] text-gray-400 leading-snug">{a.desc}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <textarea value={note} onChange={e => setNote(e.target.value)}
            placeholder="ข้อมูลเพิ่มเติม (ถ้ามี) เช่น เด็กชอบวาดรูป สมาธิสั้น อ่านยังไม่คล่อง..."
            rows={2}
            className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-300 resize-none" />

          <button onClick={copy}
            className={`w-full text-white text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 ${copied ? 'bg-green-500' : 'bg-rose-500 hover:bg-rose-600'}`}>
            {copied ? <><Check size={15} /> คัดลอกแล้ว — ไปวางในเว็บ AI</> : <><Copy size={15} /> คัดลอกพรอมต์ร่างแผน</>}
          </button>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-600 flex items-center gap-1">
              <ClipboardPaste size={13} /> วางแผนที่ได้จาก AI (แก้ไข/เขียนเองได้)
            </p>
            <textarea value={pasted} onChange={e => setPasted(e.target.value)}
              placeholder="วางแผนซ่อมเสริมที่ AI ตอบกลับมาที่นี่... (เว้นว่างไว้ก่อนแล้วค่อยกลับมาเติมก็ได้)"
              rows={6}
              className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-300" />
          </div>

          {saveError && <p className="text-xs text-red-500">{saveError}</p>}
        </div>

        <div className="p-4 border-t border-gray-100">
          <button onClick={save} disabled={saving || chosenModules.length === 0}
            className="w-full bg-gray-900 hover:bg-black disabled:opacity-40 text-white text-sm font-semibold py-3 rounded-xl flex items-center justify-center gap-1.5">
            {saving && <Loader2 size={14} className="animate-spin" />}
            บันทึกแผนและเริ่มติดตามผล
          </button>
          {chosenModules.length === 0 && (
            <p className="text-[10px] text-gray-400 text-center mt-1">เลือกเรื่องที่จะซ่อมอย่างน้อย 1 เรื่อง</p>
          )}
        </div>
      </motion.div>
    </div>
  )
}
