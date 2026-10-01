import type { Classroom, ClassroomInput, SubjectOption } from '@/modules/identity/domain/Classroom'

export interface ClassroomRepository {
  list(): Promise<Classroom[]>
  subjectOptions(): Promise<SubjectOption[]>
  create(id: string, input: ClassroomInput): Promise<void>
  update(id: string, input: ClassroomInput): Promise<void>
  assignTeachers(id: string, teacherIds: readonly string[]): Promise<void>
  deactivate(id: string): Promise<void>
}
