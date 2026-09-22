import type { ClassroomDetail, ClassroomSummary } from '@/modules/identity/domain/Classroom'

/**
 * The port the offline adapter will implement. Keeping the page behind this
 * interface is why RNF03 will not require rewriting the page.
 */
export interface ClassroomRepository {
  list(): Promise<ClassroomSummary[]>
  create(input: { id: string; name: string; subjectId: string }): Promise<ClassroomDetail>
  update(id: string, input: { name: string; subjectId: string }): Promise<ClassroomDetail>
  assignTeachers(id: string, teacherIds: readonly string[]): Promise<ClassroomDetail>
  deactivate(id: string): Promise<ClassroomDetail>
}
