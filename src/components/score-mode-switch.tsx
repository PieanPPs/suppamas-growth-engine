'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles, FileSpreadsheet, BookCheck } from 'lucide-react'

const MODES = [
  { href: '/teacher/assessment', label: 'ประเมินรายคาบ', icon: Sparkles },
  { href: '/teacher/tests', label: 'แบบทดสอบ', icon: FileSpreadsheet },
  { href: '/teacher/pp5', label: 'ปพ.5', icon: BookCheck },
]

/** สลับโหมดในแท็บ "คะแนน": รายคาบ ↔ แบบทดสอบ ↔ ปพ.5 */
export function ScoreModeSwitch() {
  const pathname = usePathname()
  return (
    <div className="grid grid-cols-3 gap-1 bg-gray-100 rounded-2xl p-1">
      {MODES.map(m => {
        const active = pathname.startsWith(m.href)
        return (
          <Link
            key={m.href}
            href={m.href}
            className={`flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-xl transition-all ${
              active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <m.icon size={14} /> {m.label}
          </Link>
        )
      })}
    </div>
  )
}
