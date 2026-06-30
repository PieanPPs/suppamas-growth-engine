import type { Metadata } from 'next'
import { Anuphan, Geist_Mono, Sarabun } from 'next/font/google'
import './globals.css'
import { Navigation } from '@/components/navigation'

const anuphan = Anuphan({ subsets: ['thai', 'latin'], display: 'swap' })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
// Sarabun (TH Sarabun New) — ฟอนต์มีหัว สำหรับหน้าแบบทดสอบและเอกสารราชการ
const sarabun = Sarabun({
  weight: ['400', '600', '700'],
  subsets: ['thai', 'latin'],
  variable: '--font-sarabun',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Suppamas Growth Engine',
  description: 'ระบบติดตามการเรียนรู้ โรงเรียนอนุสรณ์ศุภมาศ',
  openGraph: {
    title: 'Suppamas Growth Engine — ไฟจราจรแห่งการเรียนรู้',
    description: 'นวัตกรรม EdTech ที่รวม Pacing · พฤติกรรม · ปพ.5/ปพ.6 ในที่เดียว',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${geistMono.variable} ${sarabun.variable} h-full antialiased`}>
      <body className={`${anuphan.className} min-h-full flex flex-col bg-gray-50`}>
        <Navigation />
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">{children}</main>
      </body>
    </html>
  )
}
