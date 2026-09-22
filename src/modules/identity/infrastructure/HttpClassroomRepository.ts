import { identityRequests } from '@/modules/identity/infrastructure/client/requests'
import type { ClassroomDetail, ClassroomSummary } from '@/modules/identity/domain/Classroom'
import type { ClassroomRepository } from '@/modules/identity/domain/ClassroomRepository'
import type { ClassroomResponse } from '@/modules/identity/infrastructure/interfaces/ClassroomResponse'

const toDomain = (response: ClassroomResponse): ClassroomDetail => ({
  id: response.id,
  name: response.name,
  subjectId: response.subject_id,
  teacherIds: response.teacher_ids,
  studentCount: response.student_count,
  active: response.active,
})

export const classroomRepository: ClassroomRepository = {
  async list(): Promise<ClassroomSummary[]> {
    const response = await identityRequests.listClassrooms()

    // Ordering is a display guarantee we own; do not depend on the server's order.
    return response.map(toDomain).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  },

  async create(input: { id: string; name: string; subjectId: string }): Promise<ClassroomDetail> {
    return toDomain(
      await identityRequests.createClassroom({ id: input.id, name: input.name, subject_id: input.subjectId }),
    )
  },

  async update(id: string, input: { name: string; subjectId: string }): Promise<ClassroomDetail> {
    return toDomain(await identityRequests.updateClassroom(id, { name: input.name, subject_id: input.subjectId }))
  },

  async assignTeachers(id: string, teacherIds: readonly string[]): Promise<ClassroomDetail> {
    return toDomain(await identityRequests.assignClassroomTeachers(id, { teacher_ids: teacherIds }))
  },

  async deactivate(id: string): Promise<ClassroomDetail> {
    return toDomain(await identityRequests.deactivateClassroom(id))
  },
}
