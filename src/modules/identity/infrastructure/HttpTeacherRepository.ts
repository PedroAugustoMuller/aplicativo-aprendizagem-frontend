import { identityRequests } from '@/modules/identity/infrastructure/client/requests'
import { toIssuedAccount } from '@/modules/identity/infrastructure/accountMapping'
import type { IssuedAccount } from '@/modules/identity/domain/IssuedAccount'
import type { NewTeacher, Teacher } from '@/modules/identity/domain/Teacher'
import type { TeacherRepository } from '@/modules/identity/domain/TeacherRepository'

export const teacherRepository: TeacherRepository = {
  async list(): Promise<Teacher[]> {
    const response = await identityRequests.listTeachers()

    // A teacher's login is their email.
    return response.map((item) => ({
      id: item.id,
      name: item.name,
      email: item.login,
      mustChangePassword: item.must_change_password,
      active: item.active,
    }))
  },

  async create(input: NewTeacher): Promise<IssuedAccount> {
    return toIssuedAccount(await identityRequests.createTeacher({ id: input.id, name: input.name, email: input.email }))
  },

  async resetPassword(id: string): Promise<IssuedAccount> {
    return toIssuedAccount(await identityRequests.resetTeacherPassword(id))
  },

  async setActive(id: string, active: boolean): Promise<void> {
    await (active ? identityRequests.reactivateTeacher(id) : identityRequests.deactivateTeacher(id))
  },
}
