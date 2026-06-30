'use client'

export const dynamic = 'force-dynamic'

import { AuthGuard } from '@/components/auth-guard'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard roles={['admin', 'principal']}>
      {children}
    </AuthGuard>
  )
}
