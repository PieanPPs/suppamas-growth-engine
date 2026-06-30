'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { Loader2 } from 'lucide-react'

export default function OverviewRedirect() {
  const router = useRouter()
  useEffect(() => {
    const s = getSession()
    if (!s) { router.replace('/login'); return }
    if (s.role === 'teacher') router.replace('/teacher/overview')
    else router.replace('/admin/dashboard')
  }, [])
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="animate-spin text-teal-500" size={32} />
    </div>
  )
}
