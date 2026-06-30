import type { UserRole } from './types'

export type { UserRole }

export interface Session {
  userId: string   // teachers.id ของคนที่ login
  name: string
  role: UserRole
}

export function getSession(): Session | null {
  if (typeof window === 'undefined') return null
  const role = localStorage.getItem('sge_role') as UserRole | null
  const name = localStorage.getItem('sge_teacher_name')
  const userId = localStorage.getItem('sge_user_id') ?? ''
  if (!role || !name) return null
  return { userId, name, role }
}

export function setSession(session: Session) {
  localStorage.setItem('sge_user_id', session.userId)
  localStorage.setItem('sge_teacher_name', session.name)
  localStorage.setItem('sge_role', session.role)
  // sge_teacher_id ใช้กรองข้อมูลในหน้าครู — ตั้งเฉพาะ role=teacher
  if (session.role === 'teacher') {
    localStorage.setItem('sge_teacher_id', session.userId)
  } else {
    localStorage.removeItem('sge_teacher_id')
  }
}

export function clearSession() {
  localStorage.removeItem('sge_user_id')
  localStorage.removeItem('sge_teacher_id')
  localStorage.removeItem('sge_teacher_name')
  localStorage.removeItem('sge_role')
}
