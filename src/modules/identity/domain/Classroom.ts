export interface TeacherAssignment {
  readonly teacherId: string
  /** null: the whole classroom. */
  readonly subjectId: string | null
}

export interface Classroom {
  readonly id: string
  readonly name: string
  readonly subjectIds: readonly string[]
  /** Empty for students: the backend hides who teaches from them. */
  readonly assignments: readonly TeacherAssignment[]
  readonly studentCount: number
  readonly active: boolean
}

export interface ClassroomInput {
  readonly name: string
  readonly subjectIds: readonly string[]
}

/** A subject as Identity needs it to label and create classes; Content owns subjects. */
export interface SubjectOption {
  readonly id: string
  readonly name: string
  readonly active: boolean
}
