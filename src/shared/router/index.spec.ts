import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { router } from '@/shared/router'

// This spec exercises the REAL application router (the one main.ts installs),
// not a hand-built stub like guard.spec.ts uses. It exists because
// /change-password was, for a while, only reachable through guard.ts's
// resolveNavigation without ever being registered as a real route: a pending
// password change was redirected there, matched nothing, fell through the
// catch-all back to '/', and got redirected again - an infinite loop that
// stranded the seeded diego.souza account.
//
// shared/router may reach a module only through application/ and presentation/
// (dependency-cruiser), so - like guard.spec.ts - this mocks the repository by
// path and touches the persisted token through localStorage rather than
// importing infrastructure.
const { currentUser } = vi.hoisted(() => ({ currentUser: vi.fn() }))

vi.mock('@/modules/identity/infrastructure/HttpAuthRepository', () => ({
  authRepository: { login: vi.fn(), logout: vi.fn(), currentUser, changePassword: vi.fn() },
}))

const TOKEN_KEY = 'quimica.auth.token'
const tokenStorage = {
  write: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

describe('the real application router', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    tokenStorage.clear()
  })

  it('lands a session with a pending password change on /change-password and stays there', async () => {
    tokenStorage.write('valid')
    currentUser.mockResolvedValue({
      userId: 'u-2',
      name: 'Diego',
      login: 'diego.souza',
      role: 'student',
      mustChangePassword: true,
    })

    await router.push('/')

    expect(router.currentRoute.value.path).toBe('/change-password')

    // Give any further (unwanted) redirect a chance to fire before asserting
    // it stayed put - a loop back through the catch-all would move it again.
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(router.currentRoute.value.path).toBe('/change-password')
  })
})
