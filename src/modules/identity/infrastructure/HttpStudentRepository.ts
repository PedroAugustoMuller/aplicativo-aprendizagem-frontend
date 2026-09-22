import { identityRequests } from '@/modules/identity/infrastructure/client/requests'
import { toAccountDetail, toAccountSummary, toCredentialSlip } from '@/modules/identity/infrastructure/accountMapping'
import type { AccountDetail, AccountSummary, CredentialSlip } from '@/modules/identity/domain/Account'
import type { StudentRepository } from '@/modules/identity/domain/StudentRepository'

export const studentRepository: StudentRepository = {
  async listByClassroom(classroomId: string): Promise<AccountSummary[]> {
    const response = await identityRequests.listClassroomStudents(classroomId)

    // Ordering is a display guarantee we own; do not depend on the server's order.
    return response.map(toAccountSummary).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  },

  async createInClassroom(
    classroomId: string,
    students: readonly { id: string; name: string }[],
  ): Promise<AccountDetail[]> {
    // Kept in paste order, not re-sorted: the caller shows this as a result
    // list matching what was typed.
    const response = await identityRequests.createClassroomStudents(classroomId, { students })
    return response.map(toAccountDetail)
  },

  async enrol(classroomId: string, studentId: string): Promise<void> {
    await identityRequests.enrolClassroomStudent(classroomId, studentId)
  },

  async unenrol(classroomId: string, studentId: string): Promise<void> {
    await identityRequests.unenrolClassroomStudent(classroomId, studentId)
  },

  async resetPassword(studentId: string): Promise<AccountDetail> {
    return toAccountDetail(await identityRequests.resetStudentPassword(studentId))
  },

  async setActive(studentId: string, active: boolean): Promise<AccountDetail> {
    return toAccountDetail(
      active ? await identityRequests.reactivateStudent(studentId) : await identityRequests.deactivateStudent(studentId),
    )
  },

  async credentials(classroomId: string): Promise<CredentialSlip[]> {
    const response = await identityRequests.listClassroomCredentials(classroomId)
    return response.map(toCredentialSlip)
  },
}
