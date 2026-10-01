import type { AuthenticatedUser } from '@/modules/identity/domain/Session'

const TOKEN_KEY = 'dp2.auth.token'
// Not a secret: who confirmed the session last, so an offline reload still knows
// whose saved lists to show and which menu to draw. Never trusted for access -
// the server decides that on every request.
const USER_KEY = 'dp2.auth.user'

const ROLES = ['admin', 'teacher', 'student']

function isAuthenticatedUser(raw: unknown): raw is AuthenticatedUser {
  return (
    typeof raw === 'object' && raw !== null &&
    'userId' in raw && typeof raw.userId === 'string' &&
    'name' in raw && typeof raw.name === 'string' &&
    'login' in raw && typeof raw.login === 'string' &&
    'role' in raw && typeof raw.role === 'string' && ROLES.includes(raw.role) &&
    'mustChangePassword' in raw && typeof raw.mustChangePassword === 'boolean'
  )
}

/**
 * localStorage throws in private mode and in some embedded browsers.
 * A student on a locked-down school device must still reach the login screen.
 */
export const tokenStorage = {
  read(): string | null {
    try {
      return globalThis.localStorage?.getItem(TOKEN_KEY) ?? null
    } catch {
      return null
    }
  },

  write(token: string): void {
    try {
      globalThis.localStorage?.setItem(TOKEN_KEY, token)
    } catch {
      // Session stays in memory only. Acceptable degradation.
    }
  },

  readUser(): AuthenticatedUser | null {
    try {
      const raw = globalThis.localStorage?.getItem(USER_KEY) ?? null
      const parsed: unknown = raw === null ? null : JSON.parse(raw)

      return isAuthenticatedUser(parsed) ? parsed : null
    } catch {
      return null
    }
  },

  writeUser(user: AuthenticatedUser): void {
    try {
      globalThis.localStorage?.setItem(USER_KEY, JSON.stringify(user))
    } catch {
      // Offline reloads then show no saved lists. Acceptable degradation.
    }
  },

  clear(): void {
    try {
      globalThis.localStorage?.removeItem(TOKEN_KEY)
      globalThis.localStorage?.removeItem(USER_KEY)
    } catch {
      // Nothing to do.
    }
  },
}
