import { api } from '@/shared/api/client'
import { identityRoutes } from '@/modules/identity/infrastructure/client/routes'
import type {
  CurrentUserResponse,
  LoginResponse,
} from '@/modules/identity/infrastructure/interfaces/LoginResponse'

export const identityRequests = {
  login: (data: { email: string; password: string }) =>
    api.post<LoginResponse>({ url: identityRoutes.login, data }),

  logout: () => api.post<null>({ url: identityRoutes.logout }),

  currentUser: () => api.get<CurrentUserResponse>({ url: identityRoutes.me }),
}
