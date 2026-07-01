'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { AcademicSettings, School } from '@/lib/types'
import { getSchoolId, setSchoolId } from '@/lib/school'
import { ArrowLeft, Loader2, Settings, Save, CheckCircle2, CalendarDays, School as SchoolIcon, ImageUp } from 'lucide-react'

/** ย่อรูปให้พอดีกรอบสี่เหลี่ยม (คงสัดส่วน) แล้วคืนเป็น PNG blob — ใช้ก่อนอัปโหลดโลโก้ทุกครั้ง */
function resizeImageToFit(file: File, maxSize: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas unsupported')); return }
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/png')
    }
    img.onerror = reject
    img.src = url
  })
}

export default function SettingsPage() {
  const supabase = createClient()
  const schoolId = getSchoolId()
  const [settings, setSettings] = useState<AcademicSettings | null>(null)
  const [school, setSchool] = useState<School | null>(null)
  const [allSchools, setAllSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoError, setLogoError] = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: st }, { data: sc }, { data: allSc }] = await Promise.all([
        supabase.from('academic_settings').select('*').eq('school_id', schoolId).maybeSingle(),
        supabase.from('schools').select('*').eq('id', schoolId).single(),
        supabase.from('schools').select('*').order('name'),
      ])
      setSettings((st as AcademicSettings) ?? { id: 1, school_id: schoolId, term_name: 'ภาคเรียนที่ 1', term_start_date: '2026-05-18', total_weeks: 20 })
      setSchool(sc as School | null)
      setAllSchools((allSc ?? []) as School[])
      setLoading(false)
    }
    load()
  }, [])

  async function selectLogo(file: File | null) {
    if (!file) return
    setLogoError('')
    try {
      const resized = await resizeImageToFit(file, 500)
      setLogoFile(new File([resized], 'logo.png', { type: 'image/png' }))
      setLogoPreview(URL.createObjectURL(resized))
    } catch {
      setLogoError('ไม่สามารถอ่านไฟล์รูปนี้ได้')
    }
  }

  async function save() {
    if (!settings) return
    setSaving(true)
    // upsert academic settings (unique per school_id)
    await supabase.from('academic_settings').upsert({
      school_id: schoolId,
      term_name: settings.term_name,
      term_start_date: settings.term_start_date,
      total_weeks: settings.total_weeks,
    }, { onConflict: 'school_id' })

    let logoPath = school?.logo_path ?? null
    if (logoFile) {
      const path = `${schoolId}/logo.png`
      const { error } = await supabase.storage.from('school-assets').upload(path, logoFile, { upsert: true })
      if (!error) logoPath = path
    }

    // update school info
    if (school) {
      await supabase.from('schools').update({
        name: school.name,
        short_name: school.short_name,
        director_name: school.director_name,
        province: school.province,
        school_code: school.school_code,
        address: school.address,
        phone: school.phone,
        logo_path: logoPath,
      }).eq('id', schoolId)
      setSchool({ ...school, logo_path: logoPath })
    }
    setLogoFile(null)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const currentLogoUrl = school?.logo_path
    ? supabase.storage.from('school-assets').getPublicUrl(school.logo_path).data.publicUrl
    : null

  if (loading || !settings) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
  }

  return (
    <div className="space-y-5 pb-8">
      <Link href="/admin/manage" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> ระบบหลังบ้าน
      </Link>

      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Settings size={20} className="text-gray-600" /> ตั้งค่าระบบ
        </h2>
        <p className="text-sm text-gray-500 mt-1">ข้อมูลโรงเรียนและปฏิทินการศึกษา</p>
      </div>

      {/* School selector (multi-school) */}
      {allSchools.length > 1 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1"><SchoolIcon size={14} /> เปลี่ยนโรงเรียน</p>
          <select
            value={schoolId}
            onChange={e => { setSchoolId(e.target.value); window.location.reload() }}
            className="w-full text-sm border border-blue-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {allSchools.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* School info */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
          <SchoolIcon size={15} className="text-indigo-500" /> ข้อมูลโรงเรียน
        </h3>

        {/* Logo upload */}
        <div>
          <span className="block text-xs text-gray-500 mb-1.5">โลโก้โรงเรียน (ใช้พิมพ์บนแผนการสอน/เอกสาร — ระบบย่อภาพให้พอดีเองอัตโนมัติ)</span>
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
              {(logoPreview ?? currentLogoUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview ?? currentLogoUrl ?? ''} alt="โลโก้โรงเรียน" className="w-full h-full object-contain" />
              ) : (
                <ImageUp size={22} className="text-gray-300" />
              )}
            </div>
            <label className="text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-2 rounded-lg cursor-pointer transition-colors">
              เลือกไฟล์รูป
              <input type="file" accept="image/*" className="hidden" onChange={e => selectLogo(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          {logoFile && <p className="text-[11px] text-emerald-600 mt-1.5">เลือกไฟล์ใหม่แล้ว — กด &quot;บันทึกการตั้งค่า&quot; ด้านล่างเพื่ออัปโหลด</p>}
          {logoError && <p className="text-[11px] text-red-500 mt-1.5">{logoError}</p>}
        </div>

        <label className="block text-xs text-gray-500">ชื่อโรงเรียน
          <input value={school?.name ?? ''} onChange={e => setSchool(s => s ? { ...s, name: e.target.value } : s)}
            className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-gray-500">ชื่อย่อ
            <input value={school?.short_name ?? ''} onChange={e => setSchool(s => s ? { ...s, short_name: e.target.value } : s)}
              className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </label>
          <label className="block text-xs text-gray-500">รหัสโรงเรียน (สพฐ.)
            <input value={school?.school_code ?? ''} onChange={e => setSchool(s => s ? { ...s, school_code: e.target.value } : s)}
              className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </label>
        </div>
        <label className="block text-xs text-gray-500">ผู้อำนวยการ
          <input value={school?.director_name ?? ''} onChange={e => setSchool(s => s ? { ...s, director_name: e.target.value } : s)}
            className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </label>
        <label className="block text-xs text-gray-500">จังหวัด
          <input value={school?.province ?? ''} onChange={e => setSchool(s => s ? { ...s, province: e.target.value } : s)}
            className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </label>
      </div>

      {/* Academic calendar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
          <CalendarDays size={15} className="text-blue-500" /> ปฏิทินการศึกษา
        </h3>
        <label className="block text-xs text-gray-500">ชื่อภาคเรียน
          <input value={settings.term_name} onChange={e => setSettings({ ...settings, term_name: e.target.value })}
            className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-gray-500">วันเปิดเทอม
            <input type="date" value={settings.term_start_date} onChange={e => setSettings({ ...settings, term_start_date: e.target.value })}
              className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </label>
          <label className="block text-xs text-gray-500">จำนวนสัปดาห์
            <input type="number" value={settings.total_weeks} onChange={e => setSettings({ ...settings, total_weeks: Number(e.target.value) })}
              className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </label>
        </div>
      </div>

      <motion.button whileTap={{ scale: 0.98 }} onClick={save} disabled={saving}
        className={`w-full text-white text-sm font-semibold py-3 rounded-xl flex items-center justify-center gap-1.5 ${saved ? 'bg-green-500' : 'bg-blue-600 hover:bg-blue-700'}`}>
        {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <><CheckCircle2 size={16} /> บันทึกแล้ว</> : <><Save size={16} /> บันทึกการตั้งค่า</>}
      </motion.button>
    </div>
  )
}
