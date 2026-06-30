'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BookOpen, ClipboardList, BarChart3, BookCheck, LogOut } from 'lucide-react'
import { getSession, clearSession } from '@/lib/auth'
import type { Session } from '@/lib/auth'

type NavItem = { href: string; label: string; icon: React.ComponentType<{size?:number;className?:string}>; small: boolean; roles: string[] | null }

const NAV_ITEMS: NavItem[] = [
  { href: '/teacher/pacing',     label: 'แผนสอน',                              icon: BookOpen,      small: false, roles: null },
  { href: '/teacher/assessment', label: 'เช็คชื่อ/บันทึกพฤติกรรม/แบบทดสอบ', icon: ClipboardList, small: true,  roles: null },
  { href: '/teacher/homework',   label: 'ภาระงาน/ชิ้นงาน',                    icon: BookCheck,     small: true,  roles: null },
  { href: '/overview',           label: 'ภาพรวม',                              icon: BarChart3,     small: false, roles: null },
]

const ROLE_LABEL: Record<string, { label: string; cls: string }> = {
  admin:     { label: 'แอดมิน', cls: 'bg-purple-100 text-purple-700' },
  principal: { label: 'ผอ.',     cls: 'bg-blue-100 text-blue-700' },
  teacher:   { label: 'ครู',     cls: 'bg-teal-100 text-teal-700' },
}

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    setSession(getSession())
  }, [pathname]) // refresh ทุกครั้งที่เปลี่ยน path

  function logout() {
    clearSession()
    router.push('/login')
  }

  // Standalone public pages — no chrome
  if (pathname === '/' || pathname === '/login' || pathname.startsWith('/report')) return null

  const roleInfo = session ? (ROLE_LABEL[session.role] ?? ROLE_LABEL.teacher) : null

  return (
    <>
      {/* Top header */}
      <header className="bg-white border-b border-gray-200 px-4 py-2.5 print:hidden">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Suppamas Growth Engine" width={30} height={30}
              className="rounded-lg flex-shrink-0"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <div>
              <h1 className="text-sm font-bold text-gray-800 leading-tight">Suppamas Growth Engine</h1>
              <p className="text-[11px] text-gray-500">โรงเรียนอนุสรณ์ศุภมาศ</p>
            </div>
          </div>

          {/* User info + logout */}
          {session && (
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-gray-800 leading-tight">{session.name}</p>
                {roleInfo && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${roleInfo.cls}`}>
                    {roleInfo.label}
                  </span>
                )}
              </div>
              {/* mobile: show role badge only */}
              {roleInfo && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full sm:hidden ${roleInfo.cls}`}>
                  {roleInfo.label}
                </span>
              )}
              <button onClick={logout}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="ออกจากระบบ">
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Bottom tab navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 print:hidden">
        <div className="max-w-2xl mx-auto flex">
          {NAV_ITEMS
            .filter(item => !item.roles || (session && item.roles.includes(session.role)))
            .map(({ href, label, icon: Icon, small }) => {
            const active = pathname.startsWith(href) ||
              (href === '/teacher/assessment' &&
                (pathname.startsWith('/teacher/tests') || pathname.startsWith('/teacher/pp5'))) ||
              (href === '/overview' &&
                (pathname.startsWith('/admin/dashboard') || pathname.startsWith('/teacher/overview')))
            return (
              <Link key={href} href={href}
                className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                  active ? 'text-blue-600 border-t-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}>
                <Icon size={20} />
                <span className={small ? 'text-[8px] leading-tight text-center' : ''}>{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="h-16" />
    </>
  )
}
