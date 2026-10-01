import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, START_LOCATION, type Router } from 'vue-router'
import {
  createUnauthorizedHandler,
  installSessionGuard,
  resolveNavigation,
  unauthorizedRedirect,
} from '@/shared/router/guard'
import { useSessionStore } from '@/modules/identity/application/sessionStore'
import { ApiError } from '@/shared/api/error'

// shared/router may reach a module only through application/ and presentation/
// (dependency-cruiser), so this spec mocks the repository by path and touches
// the persisted token through localStorage rather than importing infrastructure.
const { currentUser } = vi.hoisted(() => ({ currentUser: vi.fn() }))

vi.mock('@/modules/identity/infrastructure/HttpAuthRepository', () => ({
  authRepository: { login: vi.fn(), logout: vi.fn(), currentUser, changePassword: vi.fn() },
}))

const TOKEN_KEY = 'dp2.auth.token'
const tokenStorage = {
  write: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  read: () => localStorage.getItem(TOKEN_KEY),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

const ANA = { userId: 'u-1', name: 'Ana', login: 'ana@escola.br', role: 'admin', mustChangePassword: false } as const

describe('resolveNavigation', () => {
  const protectedRoute = { requiresAuth: true, guestOnly: false, passwordChange: false, roles: null }
  const guestRoute = { requiresAuth: false, guestOnly: true, passwordChange: false, roles: null }
  const passwordRoute = { requiresAuth: true, guestOnly: false, passwordChange: true, roles: null }
  const signedIn = { hasSession: true, expired: false, mustChangePassword: false, role: null }
  const pending = { hasSession: true, expired: false, mustChangePassword: true, role: null }

  it('sends a visitor without a session from a protected route to login', () => {
    expect(resolveNavigation(protectedRoute, { hasSession: false, expired: false, mustChangePassword: false, role: null }, '/topics'))
      .toEqual({ path: '/login', query: { redirect: '/topics' } })
  })

  it('tells the login page why when the session was just rejected', () => {
    expect(resolveNavigation(protectedRoute, { hasSession: false, expired: true, mustChangePassword: false, role: null }, '/topics'))
      .toEqual({ path: '/login', query: { redirect: '/topics', reason: 'expired' } })
  })

  it('lets a session through a protected route', () => {
    expect(resolveNavigation(protectedRoute, { hasSession: true, expired: false, mustChangePassword: false, role: null }, '/topics')).toBe(true)
  })

  it('sends a session away from the login page', () => {
    expect(resolveNavigation(guestRoute, { hasSession: true, expired: false, mustChangePassword: false, role: null }, '/login'))
      .toEqual({ path: '/subjects' })
  })

  it('sends a user with a temporary password from any protected route to the change page', () => {
    expect(resolveNavigation(protectedRoute, pending, '/subjects/s-1/topics'))
      .toEqual({ path: '/change-password', query: { redirect: '/subjects/s-1/topics' } })
  })

  it('lets a user with a temporary password reach the change page', () => {
    expect(resolveNavigation(passwordRoute, pending, '/change-password')).toBe(true)
  })

  it('sends a user with a temporary password away from login to the change page', () => {
    expect(resolveNavigation(guestRoute, pending, '/login')).toEqual({ path: '/change-password' })
  })

  it('still lets a user with a normal password open the change page voluntarily', () => {
    expect(resolveNavigation(passwordRoute, signedIn, '/change-password')).toBe(true)
  })

  it('lets a visitor without a session reach the login page', () => {
    expect(resolveNavigation(guestRoute, { hasSession: false, expired: false, mustChangePassword: false, role: null }, '/login')).toBe(true)
  })

  const adminRoute = { requiresAuth: true, guestOnly: false, passwordChange: false, roles: ['admin'] }

  it('sends a user whose role may not open a page to the subjects', () => {
    expect(resolveNavigation(adminRoute, { ...signedIn, role: 'teacher' }, '/teachers')).toEqual({ path: '/subjects' })
  })

  it('lets an allowed role through', () => {
    expect(resolveNavigation(adminRoute, { ...signedIn, role: 'admin' }, '/teachers')).toBe(true)
  })

  it('lets a not-yet-known user through; the server still answers 403', () => {
    expect(resolveNavigation(adminRoute, signedIn, '/teachers')).toBe(true)
  })
})

describe('unauthorizedRedirect', () => {
  it('does not navigate before the first navigation has settled', () => {
    // On first load the guard's own restore() owns the redirect; a second push
    // from onUnauthorized would race it.
    expect(unauthorizedRedirect(START_LOCATION)).toBeNull()
  })

  it('does not navigate away from a route that needs no session', () => {
    expect(unauthorizedRedirect({ meta: { guestOnly: true } })).toBeNull()
  })

  it('sends a user on a protected route to login with the expiry notice', () => {
    expect(unauthorizedRedirect({ meta: { requiresAuth: true } }))
      .toEqual({ path: '/login', query: { reason: 'expired' } })
  })
})

describe('session guard and onUnauthorized, wired to a real router', () => {
  const Stub = defineComponent({ render: () => null })
  let router: Router
  let onUnauthorized: () => void

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    tokenStorage.clear()

    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', component: Stub, meta: { guestOnly: true } },
        { path: '/topics', component: Stub, meta: { requiresAuth: true } },
        { path: '/change-password', component: Stub, meta: { requiresAuth: true, passwordChange: true } },
        { path: '/subjects', component: Stub, meta: { requiresAuth: true } },
        { path: '/teachers', component: Stub, meta: { requiresAuth: true, roles: ['admin'] } },
      ],
    })
    installSessionGuard(router, () => useSessionStore())
    onUnauthorized = createUnauthorizedHandler(() => useSessionStore(), router)
  })

  /** What the fetch transport does on a 401 to a request that carried a token. */
  const rejectLikeTheTransport = () => {
    onUnauthorized()

    return Promise.reject(new ApiError('auth.unauthenticated', {}, 401))
  }

  it('redirects a reload with a rejected token to login with the expiry notice and the target', async () => {
    tokenStorage.write('stale')
    currentUser.mockImplementation(rejectLikeTheTransport)
    const push = vi.spyOn(router, 'push')

    await router.push('/topics')

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query).toEqual({ redirect: '/topics', reason: 'expired' })
    expect(useSessionStore().hasSession).toBe(false)
    expect(tokenStorage.read()).toBeNull()
    // Only the test's own push: onUnauthorized left the first-load redirect to the guard.
    expect(push).toHaveBeenCalledTimes(1)
  })

  it('keeps the token and loads the protected route when restore cannot reach the server', async () => {
    tokenStorage.write('persisted')
    currentUser.mockRejectedValue(new ApiError('api.network_unavailable'))

    await router.push('/topics')

    expect(router.currentRoute.value.path).toBe('/topics')
    expect(useSessionStore().hasSession).toBe(true)
    expect(tokenStorage.read()).toBe('persisted')
  })

  it('sends a signed-in user to login with the expiry notice on a mid-session 401', async () => {
    tokenStorage.write('valid')
    currentUser.mockResolvedValue(ANA)
    await router.push('/topics')
    expect(router.currentRoute.value.path).toBe('/topics')

    // e.g. GET /topics answered 401 because the token was revoked meanwhile.
    onUnauthorized()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/login'))

    expect(router.currentRoute.value.query).toEqual({ reason: 'expired' })
    expect(useSessionStore().hasSession).toBe(false)
  })

  it('ends on the expiry notice when a session that started offline is rejected on a later navigation', async () => {
    tokenStorage.write('revoked')
    currentUser.mockRejectedValueOnce(new ApiError('api.network_unavailable'))
    await router.push('/topics')
    expect(router.currentRoute.value.path).toBe('/topics')

    // Back online: the guard retries restore() on the next navigation and the
    // server rejects the token. Here onUnauthorized (current route requires auth)
    // and the guard both redirect; whichever wins, the notice must survive.
    currentUser.mockImplementationOnce(rejectLikeTheTransport)
    await router.push('/login').catch(() => undefined)
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/login'))

    expect(router.currentRoute.value.query.reason).toBe('expired')
    expect(useSessionStore().hasSession).toBe(false)
  })

  it('sends a restored user who must change the password to the change page', async () => {
    tokenStorage.write('valid')
    currentUser.mockResolvedValue({ ...ANA, mustChangePassword: true })

    await router.push('/topics')

    expect(router.currentRoute.value.path).toBe('/change-password')
    expect(router.currentRoute.value.query).toEqual({ redirect: '/topics' })
  })

  it('sends a visitor without a token to login without the expiry notice', async () => {
    await router.push('/topics')

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query).toEqual({ redirect: '/topics' })
    expect(currentUser).not.toHaveBeenCalled()
  })

  it('keeps a restored student out of an admin page', async () => {
    tokenStorage.write('valid')
    currentUser.mockResolvedValue({ ...ANA, role: 'student' })

    await router.push('/teachers')

    expect(router.currentRoute.value.path).toBe('/subjects')
  })
})
