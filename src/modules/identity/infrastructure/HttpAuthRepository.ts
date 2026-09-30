import { identityRequests } from '@/modules/identity/infrastructure/client/requests'
import { ApiError } from '@/shared/api/error'
import type { AuthRepository } from '@/modules/identity/domain/AuthRepository'
import type { AuthenticatedUser, Credentials, Role, Session } from '@/modules/identity/domain/Session'
import type { CurrentUserResponse } from '@/modules/identity/infrastructure/interfaces/LoginResponse'

const ROLES: readonly Role[] = ['admin', 'teacher', 'student']

/** An unknown role is a contract break, not something the domain should carry. */
function toRole(value: string): Role {
  const role = ROLES.find((candidate) => candidate === value)

  if (role === undefined) {
    throw new ApiError('api.unexpected_response')
  }

  return role
}

const toUser = (response: CurrentUserResponse): AuthenticatedUser => ({
  userId: response.id,
  name: response.name,
  login: response.login,
  role: toRole(response.role),
  mustChangePassword: response.must_change_password,
})

export const authRepository: AuthRepository = {
  async login(credentials: Credentials): Promise<Session> {
    const response = await identityRequests.login({
      login: credentials.login,
      password: credentials.password,
    })

    return { ...toUser(response), token: response.token }
  },

  async logout(): Promise<void> {
    await identityRequests.logout()
  },

  async currentUser(): Promise<AuthenticatedUser> {
    return toUser(await identityRequests.currentUser())
  },
}
