import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authRepository } from '@/modules/identity/infrastructure/HttpAuthRepository'
import { tokenStorage } from '@/modules/identity/infrastructure/persistence/tokenStorage'
import { ApiError } from '@/shared/api/error'
import type { AuthenticatedUser, Credentials, PasswordChange, Role } from '@/modules/identity/domain/Session'

export type { Role } from '@/modules/identity/domain/Session'

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
  const restoring = ref(false)
  let inFlight: Promise<RestoreOutcome> | null = null

  // hasSession: a token exists, whether or not the server has confirmed it yet.
  // Navigation and the shell gate on this, so an offline reload stays inside the
  // app (pages show their own retry) instead of bouncing to the login screen.
  const hasSession = computed(() => token.value !== null)
  // isAuthenticated: the server has confirmed the token and the user is known.
  const isAuthenticated = computed(() => token.value !== null && user.value !== null)
  const role = computed<Role | null>(() => user.value?.role ?? null)
  const mustChangePassword = computed(() => user.value?.mustChangePassword === true)

  async function login(credentials: Credentials): Promise<void> {
    const session = await authRepository.login(credentials)
    const { token: issued, ...profile } = session

    token.value = issued
    user.value = profile
    tokenStorage.write(issued)
  }

  function clear(): void {
    token.value = null
    user.value = null
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

  async function changePassword(change: PasswordChange): Promise<void> {
    await authRepository.changePassword(change)
    if (user.value !== null) {
      user.value = { ...user.value, mustChangePassword: false }
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
        user.value = await authRepository.currentUser()

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
    role,
    mustChangePassword,
    login,
    logout,
    changePassword,
    clear,
    restore,
  }
})
