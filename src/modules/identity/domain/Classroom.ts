export interface Classroom {
  readonly id: string
  readonly name: string
  readonly subjectId: string
  /** Empty for students: the backend hides who teaches from them. */
  readonly teacherIds: readonly string[]
  readonly studentCount: number
  readonly active: boolean
}

export interface ClassroomInput {
  readonly name: string
  readonly subjectId: string
}

/** A subject as Identity needs it to label and create classes; Content owns subjects. */
export interface SubjectOption {
  readonly id: string
  readonly name: string
  readonly active: boolean
}
