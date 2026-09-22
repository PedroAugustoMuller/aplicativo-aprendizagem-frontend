import { identityRequests } from '@/modules/identity/infrastructure/client/requests'
import { toAccountDetail, toAccountSummary } from '@/modules/identity/infrastructure/accountMapping'
import type { AccountDetail, AccountSummary } from '@/modules/identity/domain/Account'
import type { TeacherRepository } from '@/modules/identity/domain/TeacherRepository'

export const teacherRepository: TeacherRepository = {
  async list(): Promise<AccountSummary[]> {
    const response = await identityRequests.listTeachers()

    // Ordering is a display guarantee we own; do not depend on the server's order.
    return response.map(toAccountSummary).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  },

  async create(input: { id: string; name: string; email: string }): Promise<AccountDetail> {
    return toAccountDetail(await identityRequests.createTeacher(input))
  },

  async resetPassword(id: string): Promise<AccountDetail> {
    return toAccountDetail(await identityRequests.resetTeacherPassword(id))
  },

  async setActive(id: string, active: boolean): Promise<AccountDetail> {
    return toAccountDetail(
      active ? await identityRequests.reactivateTeacher(id) : await identityRequests.deactivateTeacher(id),
    )
  },
}
