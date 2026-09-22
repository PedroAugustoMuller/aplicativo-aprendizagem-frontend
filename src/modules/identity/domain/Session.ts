export type Role = 'admin' | 'teacher' | 'student'

export interface AuthenticatedUser {
  readonly userId: string
  readonly name: string
  readonly login: string
  readonly role: Role
  readonly mustChangePassword: boolean
}

export interface Session extends AuthenticatedUser {
  readonly token: string
}

export interface Credentials {
  readonly login: string
  readonly password: string
}

export interface PasswordChange {
  readonly currentPassword: string
  readonly newPassword: string
}

export const isStaff = (role: Role): boolean => role !== 'student'
