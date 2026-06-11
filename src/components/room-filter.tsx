'use client'

/** แถบเลือกห้องเรียน — ใช้ร่วมทุกหน้าที่มีรายชื่อนักเรียน (จำค่าผ่าน localStorage key 'sge_room') */
export const ROOM_KEY = 'sge_room'

export function readStoredRoom(options: string[]): string | null {
  if (typeof window === 'undefined') return options[0] ?? null
  const stored = localStorage.getItem(ROOM_KEY)
  if (stored && options.includes(stored)) return stored
  return options[0] ?? null
}

export function storeRoom(room: string | null) {
  if (typeof window === 'undefined') return
  localStorage.setItem(ROOM_KEY, room ?? '')
}

export function RoomFilter({
  rooms,
  value,
  onChange,
  allowAll = true,
}: {
  rooms: string[]
  value: string | null // null = ทุกห้อง
  onChange: (room: string | null) => void
  allowAll?: boolean
}) {
  if (rooms.length <= 1) return null
  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
      {rooms.map(r => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`flex-shrink-0 text-xs font-bold px-3.5 py-2 rounded-xl border transition-colors ${
            value === r
              ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
              : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          {r}
        </button>
      ))}
      {allowAll && (
        <button
          onClick={() => onChange(null)}
          className={`flex-shrink-0 text-xs font-bold px-3.5 py-2 rounded-xl border transition-colors ${
            value === null
              ? 'bg-gray-800 border-gray-800 text-white'
              : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
          }`}
        >
          ทุกห้อง
        </button>
      )}
    </div>
  )
}
