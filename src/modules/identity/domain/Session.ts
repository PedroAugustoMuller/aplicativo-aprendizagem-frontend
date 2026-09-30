export type Role = 'admin' | 'teacher' | 'student'

export interface AuthenticatedUser {
  readonly userId: string
  readonly name: string
  /** An email for staff, a username for students. */
  readonly login: string
  readonly role: Role
  readonly mustChangePassword: boolean
}

export interface Session extends AuthenticatedUser {
  readonly token: string
}

export interface Credentials {
  /** An email or a username - the backend accepts either. */
  readonly login: string
  readonly password: string
}

export interface PasswordChange {
  readonly currentPassword: string
  readonly newPassword: string
}
