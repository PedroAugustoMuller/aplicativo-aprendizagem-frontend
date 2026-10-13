import type { Classroom, ClassroomInput, SubjectOption, TeacherAssignment } from '@/modules/identity/domain/Classroom'

export interface ClassroomRepository {
  list(): Promise<Classroom[]>
  subjectOptions(): Promise<SubjectOption[]>
  create(id: string, input: ClassroomInput): Promise<void>
  rename(id: string, name: string): Promise<void>
  replaceSubjects(id: string, subjectIds: readonly string[]): Promise<void>
  assignTeachers(id: string, assignments: readonly TeacherAssignment[]): Promise<void>
  deactivate(id: string): Promise<void>
}
