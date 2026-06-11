export interface ParsedStudent {
  national_id: string | null
  student_number: string | null
  name: string
  birth_date: string | null
  status: string | null
  gender: 'male' | 'female' | null
}

export interface ParsedRoom {
  room: string          // 'ป.3/1'
  grade: string | null  // 'ป.3'
  teacher: string | null
  students: ParsedStudent[]
}

function clean(v: unknown): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim()
}

function detectGender(name: string): 'male' | 'female' | null {
  if (/เด็กชาย|^นาย|ด\.ช\./.test(name)) return 'male'
  if (/เด็กหญิง|^น\.ส\.|^นาง|ด\.ญ\./.test(name)) return 'female'
  return null
}

/** Parse an exported school roster .xlsx (one sheet per classroom). */
export async function parseStudentWorkbook(buffer: ArrayBuffer): Promise<ParsedRoom[]> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buffer, { type: 'array' })
  const rooms: ParsedRoom[] = []

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false })

    let room = sheetName.replace(/_/g, '/')
    let teacher: string | null = null
    let headerIdx = -1

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as unknown[]
      const first = clean(row[0])
      if (first === 'ชั้นเรียน') {
        if (clean(row[2])) room = clean(row[2])
        if (clean(row[4])) teacher = clean(row[4])
      }
      if (first === 'ลำดับ') { headerIdx = i; break }
    }
    if (headerIdx === -1) continue

    const students: ParsedStudent[] = []
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i] as unknown[]
      const seq = clean(row[0])
      const nationalId = clean(row[1])
      const name = clean(row[3])
      // stop at the first empty data row
      if (!seq && !nationalId && !name) continue
      if (!name) continue
      students.push({
        national_id: nationalId || null,
        student_number: clean(row[2]) || null,
        name,
        birth_date: clean(row[4]) || null,
        status: clean(row[5]) || null,
        gender: detectGender(name),
      })
    }

    rooms.push({
      room,
      grade: room.includes('/') ? room.split('/')[0] : null,
      teacher,
      students,
    })
  }

  return rooms
}
