/** Mirrors GET /classrooms elements and every classroom write's `data`. */
export interface ClassroomResponse {
  id: string
  name: string
  subject_id: string
  teacher_ids: string[]
  student_count: number
  active: boolean
}

/** Mirrors GET /subjects elements, read by Identity only to label classes. */
export interface SubjectOptionResponse {
  id: string
  name: string
  active: boolean
}
