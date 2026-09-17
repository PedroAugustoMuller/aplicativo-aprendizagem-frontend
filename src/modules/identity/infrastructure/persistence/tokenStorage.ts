const KEY = 'quimica.auth.token'

/**
 * localStorage throws in private mode and in some embedded browsers.
 * A student on a locked-down school device must still reach the login screen.
 */
export const tokenStorage = {
  read(): string | null {
    try {
      return globalThis.localStorage?.getItem(KEY) ?? null
    } catch {
      return null
    }
  },

  write(token: string): void {
    try {
      globalThis.localStorage?.setItem(KEY, token)
    } catch {
      // Session stays in memory only. Acceptable degradation.
    }
  },

  clear(): void {
    try {
      globalThis.localStorage?.removeItem(KEY)
    } catch {
      // Nothing to do.
    }
  },
}
