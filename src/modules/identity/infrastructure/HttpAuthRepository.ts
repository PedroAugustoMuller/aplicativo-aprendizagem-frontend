import { identityRequests } from '@/modules/identity/infrastructure/client/requests'
import { toRole } from '@/modules/identity/infrastructure/accountMapping'
import type { AuthRepository } from '@/modules/identity/domain/AuthRepository'
import type { AuthenticatedUser, Credentials, PasswordChange, Session } from '@/modules/identity/domain/Session'
import type { CurrentUserResponse } from '@/modules/identity/infrastructure/interfaces/LoginResponse'

const toUser = (response: CurrentUserResponse): AuthenticatedUser => ({
  userId: response.id,
  name: response.name,
  login: response.login,
  role: toRole(response.role),
  mustChangePassword: response.must_change_password,
})

export const authRepository: AuthRepository = {
  async login(credentials: Credentials): Promise<Session> {
    const response = await identityRequests.login({ login: credentials.login, password: credentials.password })
    return { ...toUser(response), token: response.token }
  },

  async logout(): Promise<void> {
    await identityRequests.logout()
  },

  async currentUser(): Promise<AuthenticatedUser> {
    return toUser(await identityRequests.currentUser())
  },

  async changePassword(change: PasswordChange): Promise<void> {
    await identityRequests.changePassword({
      current_password: change.currentPassword,
      new_password: change.newPassword,
    })
  },
}
