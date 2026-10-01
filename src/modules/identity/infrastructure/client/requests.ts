import { api } from '@/shared/api/client'
import { identityRoutes } from '@/modules/identity/infrastructure/client/routes'
import type {
  CurrentUserResponse,
  LoginResponse,
} from '@/modules/identity/infrastructure/interfaces/LoginResponse'
import type {
  AccountListItemResponse,
  AccountResponse,
} from '@/modules/identity/infrastructure/interfaces/AccountResponse'

export const identityRequests = {
  login: (data: { login: string; password: string }) =>
    api.post<LoginResponse>({ url: identityRoutes.login, data }),

  logout: () => api.post<null>({ url: identityRoutes.logout }),

  currentUser: () => api.get<CurrentUserResponse>({ url: identityRoutes.me }),

  changePassword: (data: { current_password: string; new_password: string }) =>
    api.put<null>({ url: identityRoutes.password, data }),

  listTeachers: () => api.get<AccountListItemResponse[]>({ url: identityRoutes.teachers }),

  createTeacher: (data: { id: string; name: string; email: string }) =>
    api.post<AccountResponse>({ url: identityRoutes.teachers, data }),

  resetTeacherPassword: (teacherId: string) =>
    api.post<AccountResponse>({ url: identityRoutes.teacherReset, urlParams: { teacherId } }),

  deactivateTeacher: (teacherId: string) =>
    api.post<AccountResponse>({ url: identityRoutes.teacherDeactivate, urlParams: { teacherId } }),

  reactivateTeacher: (teacherId: string) =>
    api.post<AccountResponse>({ url: identityRoutes.teacherReactivate, urlParams: { teacherId } }),
}
