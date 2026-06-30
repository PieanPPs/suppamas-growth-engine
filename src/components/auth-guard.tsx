'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { getSession } from '@/lib/auth'
import type { UserRole } from '@/lib/types'

interface Props {
  roles: UserRole[]
  children: React.ReactNode
}

export function AuthGuard({ roles, children }: Props) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const s = getSession()
    if (!s) {
      router.replace('/login')
      return
    }
    if (!roles.includes(s.role)) {
      // ส่งไปหน้าที่เหมาะสมกับ role
      if (s.role === 'admin') router.replace('/admin/manage')
      else if (s.role === 'principal') router.replace('/admin/dashboard')
      else router.replace('/teacher/pacing')
      return
    }
    setReady(true)
  }, [])

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-teal-500" size={32} />
      </div>
    )
  }
  return <>{children}</>
}
