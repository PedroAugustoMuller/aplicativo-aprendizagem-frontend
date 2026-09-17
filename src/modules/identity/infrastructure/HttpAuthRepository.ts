import { identityRequests } from '@/modules/identity/infrastructure/client/requests'
import type { AuthRepository } from '@/modules/identity/domain/AuthRepository'
import type { AuthenticatedUser, Credentials, Session } from '@/modules/identity/domain/Session'

export const authRepository: AuthRepository = {
  async login(credentials: Credentials): Promise<Session> {
    const response = await identityRequests.login({
      email: credentials.email,
      password: credentials.password,
    })

    return {
      userId: response.id,
      name: response.name,
      email: response.email,
      token: response.token,
    }
  },

  async logout(): Promise<void> {
    await identityRequests.logout()
  },

  async currentUser(): Promise<AuthenticatedUser> {
    const response = await identityRequests.currentUser()

    return { userId: response.id, name: response.name, email: response.email }
  },
}
