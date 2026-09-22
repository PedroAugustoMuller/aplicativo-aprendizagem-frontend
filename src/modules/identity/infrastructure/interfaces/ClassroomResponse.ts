/** Mirrors an element of GET /classrooms `data`, and the `data` of the write endpoints. */
export interface ClassroomResponse {
  id: string
  name: string
  subject_id: string
  teacher_ids: string[]
  student_count: number
  active: boolean
}
