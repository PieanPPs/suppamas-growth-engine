'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { setSession, getSession } from '@/lib/auth'
import type { UserRole } from '@/lib/types'
import { getSchoolId } from '@/lib/school'
import { Delete, Loader2 } from 'lucide-react'

const ROLE_HOME: Record<UserRole, string> = {
  admin:     '/admin/manage',
  principal: '/admin/dashboard',
  teacher:   '/teacher/pacing',
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const schoolId = getSchoolId()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // redirect ถ้า login อยู่แล้ว
  useEffect(() => {
    const s = getSession()
    if (s) router.replace(ROLE_HOME[s.role])
  }, [])

  function pressKey(k: string) {
    if (pin.length >= 8) return
    setPin(p => p + k)
    setError('')
  }

  function backspace() {
    setPin(p => p.slice(0, -1))
    setError('')
  }

  async function submit() {
    if (!pin || loading) return
    setLoading(true)
    setError('')
    const { data } = await supabase
      .from('teachers')
      .select('id, name, role')
      .eq('school_id', schoolId)
      .eq('pin', pin)
      .maybeSingle()

    if (!data) {
      setError('รหัสไม่ถูกต้อง กรุณาลองใหม่')
      setPin('')
      setLoading(false)
      return
    }

    const role = (data.role ?? 'teacher') as UserRole
    setSession({ userId: data.id, name: data.name, role })
    router.push(ROLE_HOME[role])
  }

  const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="flex flex-col items-center mb-10">
        <Image src="/logo.png" alt="logo" width={72} height={72}
          className="rounded-2xl shadow-md mb-4"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        <h1 className="text-xl font-bold text-gray-900">Suppamas Growth Engine</h1>
        <p className="text-sm text-gray-500 mt-0.5">โรงเรียนอนุสรณ์ศุภมาศ</p>
      </div>

      {/* PIN dots */}
      <p className="text-sm text-gray-500 mb-4">กรอกรหัสประจำตัว</p>
      <div className="flex gap-3 mb-2 h-5">
        {Array.from({ length: Math.max(pin.length, 4) }).map((_, i) => (
          <span key={i}
            className={`w-3.5 h-3.5 rounded-full transition-all ${i < pin.length ? 'bg-teal-600 scale-110' : 'bg-gray-200'}`}
          />
        ))}
      </div>

      {/* Error */}
      <div className="h-6 mb-3 flex items-center">
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-60">
        {KEYS.map((k, i) => {
          if (k === '') return <div key={i} />
          if (k === '⌫') return (
            <button key={i} onClick={backspace}
              className="h-16 rounded-2xl bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 active:scale-95 transition-all">
              <Delete size={22} />
            </button>
          )
          return (
            <button key={i} onClick={() => pressKey(k)}
              className="h-16 rounded-2xl bg-white border border-gray-200 text-gray-800 text-2xl font-semibold hover:bg-teal-50 hover:border-teal-300 active:scale-95 transition-all shadow-sm">
              {k}
            </button>
          )
        })}
      </div>

      {/* Submit */}
      <button onClick={submit} disabled={!pin || loading}
        className="mt-6 w-60 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 text-sm">
        {loading && <Loader2 size={16} className="animate-spin" />}
        เข้าสู่ระบบ
      </button>
    </div>
  )
}
