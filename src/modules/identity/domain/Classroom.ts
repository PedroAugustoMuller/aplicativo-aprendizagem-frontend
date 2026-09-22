export interface ClassroomSummary {
  readonly id: string
  readonly name: string
  readonly subjectId: string
  readonly teacherIds: readonly string[]
  readonly studentCount: number
  readonly active: boolean
}

/** Mutations return the same shape; the alias keeps call sites readable. */
export type ClassroomDetail = ClassroomSummary
