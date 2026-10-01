import { identityRequests } from '@/modules/identity/infrastructure/client/requests'
import { toIssuedAccount } from '@/modules/identity/infrastructure/accountMapping'
import type { IssuedAccount } from '@/modules/identity/domain/IssuedAccount'
import type { Credential, NewStudent, Student, StudentMatch } from '@/modules/identity/domain/Student'
import type { StudentRepository } from '@/modules/identity/domain/StudentRepository'

export const studentRepository: StudentRepository = {
  async listByClassroom(classroomId: string): Promise<Student[]> {
    const response = await identityRequests.listStudents(classroomId)

    // A student's login is their username.
    return response.map((item) => ({
      id: item.id,
      name: item.name,
      username: item.login,
      mustChangePassword: item.must_change_password,
      active: item.active,
    }))
  },

  async createMany(classroomId: string, rows: readonly NewStudent[]): Promise<IssuedAccount[]> {
    const response = await identityRequests.createStudents(
      classroomId,
      rows.map((row) => ({ id: row.id, name: row.name })),
    )

    return response.map(toIssuedAccount)
  },

  async unenrol(classroomId: string, studentId: string): Promise<void> {
    await identityRequests.unenrolStudent(classroomId, studentId)
  },

  async resetPassword(studentId: string): Promise<IssuedAccount> {
    return toIssuedAccount(await identityRequests.resetStudentPassword(studentId))
  },

  async setActive(studentId: string, active: boolean): Promise<void> {
    await (active ? identityRequests.reactivateStudent(studentId) : identityRequests.deactivateStudent(studentId))
  },

  async credentials(classroomId: string): Promise<Credential[]> {
    const response = await identityRequests.listCredentials(classroomId)

    return response.map((item) => ({
      userId: item.user_id,
      name: item.name,
      username: item.login,
      temporaryPassword: item.temporary_password,
    }))
  },

  async search(text: string): Promise<StudentMatch[]> {
    const response = await identityRequests.searchStudents(text)

    return response.map((item) => ({
      id: item.id,
      name: item.name,
      username: item.login,
      classrooms: item.classrooms.map((classroom) => ({ id: classroom.id, name: classroom.name })),
    }))
  },

  async enrol(classroomId: string, studentId: string): Promise<void> {
    await identityRequests.enrolStudent(classroomId, studentId)
  },
}
