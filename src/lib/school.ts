// school_id — โรงเรียนแรกใช้ seed UUID เดียวกับ SQL migration
export const DEFAULT_SCHOOL_ID = '00000000-0000-4000-a000-000000000001'
export const SCHOOL_KEY = 'sge_school_id'

/** อ่าน school_id จาก localStorage (ฝั่ง client) / คืน default ฝั่ง server */
export function getSchoolId(): string {
  if (typeof window === 'undefined') return DEFAULT_SCHOOL_ID
  return localStorage.getItem(SCHOOL_KEY) ?? DEFAULT_SCHOOL_ID
}

export function setSchoolId(id: string): void {
  localStorage.setItem(SCHOOL_KEY, id)
}

export interface SchoolInfo {
  id: string
  name: string
  short_name: string | null
  province: string | null
  school_code: string | null
  director_name: string | null
  address: string | null
  phone: string | null
}
