'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

/**
 * Lightweight QR scanner overlay. Dynamically loads html5-qrcode on the
 * client only (avoids SSR issues). Calls onScan with the decoded text
 * (a student id encoded on the notebook sticker).
 */
export function QrScanner({ onScan, onClose }: { onScan: (text: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null)

  useEffect(() => {
    let cancelled = false

    async function start() {
      const { Html5Qrcode } = await import('html5-qrcode')
      if (cancelled || !ref.current) return
      const scanner = new Html5Qrcode(ref.current.id)
      scannerRef.current = scanner
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decoded: string) => {
            onScan(decoded)
          },
          () => {}
        )
      } catch {
        // camera unavailable / permission denied — handled by UI hint
      }
    }
    start()

    return () => {
      cancelled = true
      const s = scannerRef.current
      if (s) {
        s.stop().then(() => s.clear()).catch(() => {})
      }
    }
  }, [onScan])

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex flex-col items-center justify-center px-4">
      <div className="bg-white rounded-3xl p-4 w-full max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-800">สแกน QR สมุดของนักเรียน</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <div id="qr-reader" ref={ref} className="rounded-2xl overflow-hidden bg-gray-100 aspect-square" />
        <p className="text-xs text-gray-400 text-center mt-3">
          หันกล้องไปที่สติกเกอร์ QR ที่มุมสมุด — ระบบจะเด้งไปที่เด็กคนนั้นอัตโนมัติ
        </p>
      </div>
    </div>
  )
}
