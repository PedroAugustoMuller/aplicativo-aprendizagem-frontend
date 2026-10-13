/** Mirrors GET /classrooms elements and every classroom write's `data`. */
export interface ClassroomResponse {
  id: string
  name: string
  subject_ids: string[]
  teachers: { teacher_id: string; subject_id: string | null }[]
  student_count: number
  active: boolean
}

/** Mirrors GET /subjects elements, read by Identity only to label classes. */
export interface SubjectOptionResponse {
  id: string
  name: string
  active: boolean
}
