export const identityRoutes = {
  login: '/auth/login',
  logout: '/auth/logout',
  me: '/auth/me',
  password: '/auth/password',
  teachers: '/teachers',
  teacherReset: '/teachers/:teacherId/reset-password',
  teacherDeactivate: '/teachers/:teacherId/deactivate',
  teacherReactivate: '/teachers/:teacherId/reactivate',
} as const
