import type { AuthenticatedUser, Credentials, PasswordChange, Session } from '@/modules/identity/domain/Session'

/**
 * The port. Today only an HTTP adapter implements it; an offline-capable
 * adapter can be added without the store or the pages changing.
 */
export interface AuthRepository {
  login(credentials: Credentials): Promise<Session>
  logout(): Promise<void>
  currentUser(): Promise<AuthenticatedUser>
  changePassword(change: PasswordChange): Promise<void>
}
