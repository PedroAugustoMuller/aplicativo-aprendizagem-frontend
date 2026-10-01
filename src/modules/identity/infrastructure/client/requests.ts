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
import type {
  ClassroomResponse,
  SubjectOptionResponse,
} from '@/modules/identity/infrastructure/interfaces/ClassroomResponse'

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

  listClassrooms: () => api.get<ClassroomResponse[]>({ url: identityRoutes.classrooms }),

  listSubjectOptions: () => api.get<SubjectOptionResponse[]>({ url: identityRoutes.subjectOptions }),

  createClassroom: (data: { id: string; name: string; subject_id: string }) =>
    api.post<ClassroomResponse>({ url: identityRoutes.classrooms, data }),

  updateClassroom: (classroomId: string, data: { name: string; subject_id: string }) =>
    api.patch<ClassroomResponse>({ url: identityRoutes.classroom, urlParams: { classroomId }, data }),

  assignClassroomTeachers: (classroomId: string, teacherIds: readonly string[]) =>
    api.put<ClassroomResponse>({
      url: identityRoutes.classroomTeachers,
      urlParams: { classroomId },
      data: { teacher_ids: teacherIds },
    }),

  deactivateClassroom: (classroomId: string) =>
    api.post<ClassroomResponse>({ url: identityRoutes.classroomDeactivate, urlParams: { classroomId } }),
}
