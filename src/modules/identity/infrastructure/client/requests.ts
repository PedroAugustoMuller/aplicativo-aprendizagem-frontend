import { api } from '@/shared/api/client'
import { identityRoutes } from '@/modules/identity/infrastructure/client/routes'
import type {
  CurrentUserResponse,
  LoginResponse,
} from '@/modules/identity/infrastructure/interfaces/LoginResponse'
import type {
  AccountDetailResponse,
  AccountSummaryResponse,
  CredentialSlipResponse,
} from '@/modules/identity/infrastructure/interfaces/AccountResponse'
import type { ClassroomResponse } from '@/modules/identity/infrastructure/interfaces/ClassroomResponse'

export const identityRequests = {
  login: (data: { login: string; password: string }) =>
    api.post<LoginResponse>({ url: identityRoutes.login, data }),

  logout: () => api.post<null>({ url: identityRoutes.logout }),

  currentUser: () => api.get<CurrentUserResponse>({ url: identityRoutes.me }),

  changePassword: (data: { current_password: string; new_password: string }) =>
    api.put<null>({ url: identityRoutes.password, data }),

  listTeachers: () => api.get<AccountSummaryResponse[]>({ url: identityRoutes.teachers }),

  createTeacher: (data: { id: string; name: string; email: string }) =>
    api.post<AccountDetailResponse>({ url: identityRoutes.teachers, data }),

  resetTeacherPassword: (id: string) =>
    api.post<AccountDetailResponse>({ url: identityRoutes.teacherReset, urlParams: { id } }),

  deactivateTeacher: (id: string) =>
    api.post<AccountDetailResponse>({ url: identityRoutes.teacherDeactivate, urlParams: { id } }),

  reactivateTeacher: (id: string) =>
    api.post<AccountDetailResponse>({ url: identityRoutes.teacherReactivate, urlParams: { id } }),

  listClassrooms: () => api.get<ClassroomResponse[]>({ url: identityRoutes.classrooms }),

  createClassroom: (data: { id: string; name: string; subject_id: string }) =>
    api.post<ClassroomResponse>({ url: identityRoutes.classrooms, data }),

  updateClassroom: (id: string, data: { name: string; subject_id: string }) =>
    api.patch<ClassroomResponse>({ url: identityRoutes.classroom, urlParams: { id }, data }),

  assignClassroomTeachers: (id: string, data: { teacher_ids: readonly string[] }) =>
    api.put<ClassroomResponse>({ url: identityRoutes.classroomTeachers, urlParams: { id }, data }),

  deactivateClassroom: (id: string) =>
    api.post<ClassroomResponse>({ url: identityRoutes.classroomDeactivate, urlParams: { id } }),

  listClassroomStudents: (id: string) =>
    api.get<AccountSummaryResponse[]>({ url: identityRoutes.classroomStudents, urlParams: { id } }),

  createClassroomStudents: (id: string, data: { students: readonly { id: string; name: string }[] }) =>
    api.post<AccountDetailResponse[]>({ url: identityRoutes.classroomStudents, urlParams: { id }, data }),

  enrolClassroomStudent: (id: string, studentId: string) =>
    api.put<ClassroomResponse>({ url: identityRoutes.classroomStudent, urlParams: { id, studentId } }),

  unenrolClassroomStudent: (id: string, studentId: string) =>
    api.delete<ClassroomResponse>({ url: identityRoutes.classroomStudent, urlParams: { id, studentId } }),

  listClassroomCredentials: (id: string) =>
    api.get<CredentialSlipResponse[]>({ url: identityRoutes.classroomCredentials, urlParams: { id } }),

  resetStudentPassword: (id: string) =>
    api.post<AccountDetailResponse>({ url: identityRoutes.studentReset, urlParams: { id } }),

  deactivateStudent: (id: string) =>
    api.post<AccountDetailResponse>({ url: identityRoutes.studentDeactivate, urlParams: { id } }),

  reactivateStudent: (id: string) =>
    api.post<AccountDetailResponse>({ url: identityRoutes.studentReactivate, urlParams: { id } }),
}
