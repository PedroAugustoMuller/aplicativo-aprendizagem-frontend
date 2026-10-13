import { identityRequests } from '@/modules/identity/infrastructure/client/requests'
import type { Classroom, ClassroomInput, SubjectOption, TeacherAssignment } from '@/modules/identity/domain/Classroom'
import type { ClassroomRepository } from '@/modules/identity/domain/ClassroomRepository'
import type { ClassroomResponse } from '@/modules/identity/infrastructure/interfaces/ClassroomResponse'

const toDomain = (response: ClassroomResponse): Classroom => ({
  id: response.id,
  name: response.name,
  subjectIds: response.subject_ids,
  assignments: response.teachers.map((t) => ({ teacherId: t.teacher_id, subjectId: t.subject_id })),
  studentCount: response.student_count,
  active: response.active,
})

export const classroomRepository: ClassroomRepository = {
  async list(): Promise<Classroom[]> {
    const response = await identityRequests.listClassrooms()

    return response.map(toDomain).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  },

  async subjectOptions(): Promise<SubjectOption[]> {
    const response = await identityRequests.listSubjectOptions()

    return response
      .map((item) => ({ id: item.id, name: item.name, active: item.active }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  },

  async create(id: string, input: ClassroomInput): Promise<void> {
    await identityRequests.createClassroom({ id, name: input.name, subject_ids: input.subjectIds })
  },

  async rename(id: string, name: string): Promise<void> {
    await identityRequests.updateClassroom(id, { name })
  },

  async replaceSubjects(id: string, subjectIds: readonly string[]): Promise<void> {
    await identityRequests.replaceClassroomSubjects(id, subjectIds)
  },

  async assignTeachers(id: string, assignments: readonly TeacherAssignment[]): Promise<void> {
    await identityRequests.assignClassroomTeachers(id, assignments.map((a) => ({ teacher_id: a.teacherId, subject_id: a.subjectId })))
  },

  async deactivate(id: string): Promise<void> {
    await identityRequests.deactivateClassroom(id)
  },
}
