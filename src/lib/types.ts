export type PacingStatus = 'Completed' | 'In_Progress' | 'Delayed'
export type FocusColor = 'Green' | 'Yellow' | 'Red'
export type HomeworkStatus = 'On_Time' | 'Late' | 'Missing'

export interface CurriculumModule {
  id: string
  subject: string
  module_code: string
  title: string
  academic_tags: string[]
  expected_duration_weeks: number
  planned_week: number | null
  sequence_order: number | null
  unit_no?: number | null
  created_by?: string | null
}

export type IndicatorType = 'interim' | 'final'

export interface Course {
  id: string
  subject_key: string
  name: string
  grade: string | null
}

export interface Indicator {
  id: string
  subject: string
  strand: string | null
  standard: string
  code: string
  description: string
  type: IndicatorType
  key_concept: string | null
  process: string | null
  sequence_order: number
}

export interface ModuleIndicator {
  module_id: string
  indicator_id: string
}

export type TestType = 'quiz' | 'midterm' | 'final' | 'mock_nt'

export interface Test {
  id: string
  subject: string
  title: string
  type: TestType
  max_score: number
  test_date: string | null
  created_at: string
}

export interface TestIndicator {
  test_id: string
  indicator_id: string
}

export interface TestScore {
  id: string
  test_id: string
  student_id: string
  score: number
  created_at: string
}

export interface TestItem {
  id: string
  test_id: string
  item_no: number
  question: string
  choice_a: string | null
  choice_b: string | null
  choice_c: string | null
  choice_d: string | null
  answer: string | null
  indicator_code: string | null
}

export interface TestItemResponse {
  id: string
  test_id: string
  test_item_id: string
  student_id: string
  correct: boolean
}

export type ScorePhase = 'before_mid' | 'after_mid' | 'midterm' | 'final'
export type ScoreSource = 'manual' | 'test' | 'stars'

export interface ScoreComponent {
  id: string
  subject: string
  name: string
  max_score: number
  phase: ScorePhase
  source: ScoreSource
  test_id: string | null
  sequence_order: number
}

export interface ComponentScore {
  id: string
  component_id: string
  student_id: string
  score: number
}

export type AttendanceStatus = 'absent' | 'sick' | 'leave' | 'late'

export interface AttendanceRecord {
  id: string
  student_id: string
  date: string // YYYY-MM-DD
  status: AttendanceStatus
}

export interface TraitRating {
  id: string
  student_id: string
  subject: string
  kind: 'trait' | 'rwa'
  item_no: number
  level: number // 3 ดีเยี่ยม / 2 ดี / 1 ผ่าน / 0 ไม่ผ่าน
}

export interface IndicatorLibraryItem {
  id: string
  subject_key: string
  subject_label: string
  strand: string | null
  standard: string
  code: string
  description: string
  type: IndicatorType
  key_concept: string | null
  process: string | null
  sequence_order: number
}

export interface PlanSubmission {
  id: string
  teacher_id: string
  module_id: string
  plan_name: string | null
  material_link: string | null
  summary_note: string | null
  routine_hook: string | null
  routine_core: string | null
  routine_active: string | null
  routine_exit: string | null
  file_path: string | null
  lesson_plan_id: string | null
  created_at: string
}

export interface AcademicSettings {
  id: number
  school_id?: string
  term_name: string
  term_start_date: string // ISO date
  total_weeks: number
  updated_at?: string
}

export interface School {
  id: string
  name: string
  short_name: string | null
  province: string | null
  school_code: string | null
  director_name: string | null
  address: string | null
  phone: string | null
  logo_path: string | null
  created_at?: string
}

export interface PacingLog {
  id: string
  teacher_id: string
  module_id: string
  lesson_plan_id: string | null
  status: PacingStatus
  created_at: string
  curriculum_modules?: CurriculumModule
}

export interface Student {
  id: string
  name: string
  class_name: string
  national_id?: string | null
  student_number?: string | null
  birth_date?: string | null
  status?: string | null
  gender?: 'male' | 'female' | null
}

export interface Classroom {
  id: string
  name: string
  grade: string | null
  homeroom_teacher: string | null
}

export type UserRole = 'admin' | 'principal' | 'teacher'

export interface Teacher {
  id: string
  name: string
  subjects: string[]
  role?: UserRole | null
  pin?: string | null
}

export type LessonPlanStatus = 'draft' | 'submitted' | 'approved' | 'revision'

export interface LessonPlan {
  id: string
  school_id: string
  teacher_id: string | null
  module_id: string | null
  plan_number: number
  topic: string
  subject: string | null
  grade: string | null
  teach_date: string | null  // YYYY-MM-DD
  indicators_interim: string | null
  indicators_final: string | null
  objectives_k: string | null
  objectives_p: string | null
  objectives_a: string | null
  key_content: string | null
  competencies: string | null
  desired_traits: string | null
  activities: string | null
  assessment: string | null
  materials: string | null
  post_lesson_note: string | null
  suggestion: string | null
  status: LessonPlanStatus
  submitted_at: string | null
  reviewed_at: string | null
  reviewer_note: string | null
  created_at: string
}

export interface StudentAssessment {
  id: string
  student_id: string
  module_id: string
  lesson_plan_id: string | null
  academic_score: 0 | 1 | 2
  focus_color: FocusColor
  soft_skill_score: 0 | 1 | 2
  created_at: string
  students?: Student
  curriculum_modules?: CurriculumModule
}

export interface HomeworkSubmission {
  id: string
  student_id: string
  module_id: string
  lesson_plan_id: string | null
  status: HomeworkStatus
  created_at: string
}

export interface HomeworkTask {
  id: string
  module_id: string
  lesson_plan_id: string | null
  title: string
  description: string | null
  created_at: string
}
