import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authRepository } from '@/modules/identity/infrastructure/HttpAuthRepository'
import { tokenStorage } from '@/modules/identity/infrastructure/persistence/tokenStorage'
import { ApiError } from '@/shared/api/error'
import type { AuthenticatedUser, Credentials, PasswordChange } from '@/modules/identity/domain/Session'

/**
 * What restore() found out:
 * - `restored`: the server accepted the token; the user is known.
 * - `rejected`: the server answered 401; the token was discarded.
 * - `unavailable`: no verdict (offline, timeout, server error); the token is kept.
 * - `skipped`: there was no token to restore.
 */
export type RestoreOutcome = 'restored' | 'rejected' | 'unavailable' | 'skipped'

export const useSessionStore = defineStore('session', () => {
  const token = ref<string | null>(tokenStorage.read())
  const user = ref<AuthenticatedUser | null>(null)
  const rememberedUser = ref<AuthenticatedUser | null>(tokenStorage.readUser())
  const restoring = ref(false)
  let inFlight: Promise<RestoreOutcome> | null = null

  // hasSession: a token exists, whether or not the server has confirmed it yet.
  // Navigation and the shell gate on this, so an offline reload stays inside the
  // app (pages show their own retry) instead of bouncing to the login screen.
  const hasSession = computed(() => token.value !== null)
  // isAuthenticated: the server has confirmed the token and the user is known.
  const isAuthenticated = computed(() => token.value !== null && user.value !== null)
  // False while the user is unknown (e.g. an offline reload): pages then show the
  // backend's own 403 until restore() succeeds and the guard can redirect.
  const mustChangePassword = computed(() => user.value?.mustChangePassword === true)
  // The confirmed user, else the one remembered from the last confirmation. Used
  // for offline reads and the menu only; the guard keeps relying on `user`.
  const knownUser = computed(() => user.value ?? rememberedUser.value)

  function remember(next: AuthenticatedUser): void {
    user.value = next
    rememberedUser.value = next
    tokenStorage.writeUser(next)
  }

  async function login(credentials: Credentials): Promise<void> {
    const { token: issued, ...authenticated } = await authRepository.login(credentials)

    token.value = issued
    remember(authenticated)
    tokenStorage.write(issued)
  }

  async function changePassword(change: PasswordChange): Promise<void> {
    await authRepository.changePassword(change)

    // The backend keeps this token and revokes the others; the session stays valid.
    if (user.value !== null) {
      remember({ ...user.value, mustChangePassword: false })
    }
  }

  function clear(): void {
    token.value = null
    user.value = null
    rememberedUser.value = null
    tokenStorage.clear()
  }

  async function logout(): Promise<void> {
    try {
      await authRepository.logout()
    } catch {
      // Signing out locally must succeed even with no network.
    } finally {
      clear()
    }
  }

  async function restore(): Promise<RestoreOutcome> {
    if (token.value === null) {
      return 'skipped'
    }

    // A router guard calls this on every navigation while a token exists but a
    // user does not. Concurrent callers must await one request, not race.
    if (inFlight !== null) {
      return inFlight
    }

    restoring.value = true

    inFlight = (async (): Promise<RestoreOutcome> => {
      try {
        remember(await authRepository.currentUser())

        return 'restored'
      } catch (failure: unknown) {
        // Only the server saying 401 ends the session. Offline, a timeout on
        // school Wi-Fi or a 5xx says nothing about the token, so keep it.
        if (failure instanceof ApiError && failure.isUnauthorized()) {
          clear()

          return 'rejected'
        }

        return 'unavailable'
      } finally {
        restoring.value = false
        inFlight = null
      }
    })()

    return inFlight
  }

  return {
    token,
    user,
    restoring,
    hasSession,
    isAuthenticated,
    mustChangePassword,
    knownUser,
    login,
    logout,
    clear,
    restore,
    changePassword,
  }
})
