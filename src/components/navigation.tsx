'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, ClipboardList, BarChart3, BookCheck, Trophy } from 'lucide-react'

const navItems = [
  { href: '/teacher/pacing', label: 'แผนสอน', icon: BookOpen },
  { href: '/teacher/assessment', label: 'คะแนน', icon: ClipboardList },
  { href: '/teacher/homework', label: 'การบ้าน', icon: BookCheck },
  { href: '/heroes', label: 'ฮีโร่', icon: Trophy },
  { href: '/admin/dashboard', label: 'ภาพรวม', icon: BarChart3 },
]

export function Navigation() {
  const pathname = usePathname()

  // Standalone public pages — no teacher/admin chrome
  // ('/' = showcase landing, '/report' = parent happiness report)
  if (pathname === '/' || pathname.startsWith('/report')) return null

  return (
    <>
      {/* Top header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 print:hidden">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-sm font-bold text-gray-800">🌱 Suppamas Growth Engine</h1>
          <p className="text-xs text-gray-500">โรงเรียนอนุสรณ์ศุภมาศ</p>
        </div>
      </header>

      {/* Bottom tab navigation (mobile-first) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 print:hidden">
        <div className="max-w-2xl mx-auto flex">
          {navItems.map(({ href, label, icon: Icon }) => {
            // /teacher/tests and /teacher/pp5 are modes of the คะแนน tab
            const active = pathname.startsWith(href) ||
              (href === '/teacher/assessment' &&
                (pathname.startsWith('/teacher/tests') || pathname.startsWith('/teacher/pp5')))
            return (
              <Link
                key={href}
                href={href}
                className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                  active
                    ? 'text-blue-600 border-t-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon size={20} />
                <span>{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Spacer so content isn't hidden behind the bottom nav */}
      <div className="h-16" />
    </>
  )
}
