import { identityRequests } from '@/modules/identity/infrastructure/client/requests'
import type { Classroom, ClassroomInput, SubjectOption } from '@/modules/identity/domain/Classroom'
import type { ClassroomRepository } from '@/modules/identity/domain/ClassroomRepository'
import type { ClassroomResponse } from '@/modules/identity/infrastructure/interfaces/ClassroomResponse'

const toDomain = (response: ClassroomResponse): Classroom => ({
  id: response.id,
  name: response.name,
  subjectId: response.subject_id,
  teacherIds: response.teacher_ids,
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
    await identityRequests.createClassroom({ id, name: input.name, subject_id: input.subjectId })
  },

  async update(id: string, input: ClassroomInput): Promise<void> {
    await identityRequests.updateClassroom(id, { name: input.name, subject_id: input.subjectId })
  },

  async assignTeachers(id: string, teacherIds: readonly string[]): Promise<void> {
    await identityRequests.assignClassroomTeachers(id, teacherIds)
  },

  async deactivate(id: string): Promise<void> {
    await identityRequests.deactivateClassroom(id)
  },
}
