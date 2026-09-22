import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, START_LOCATION, type Router } from 'vue-router'
import {
  createUnauthorizedHandler,
  homeFor,
  installSessionGuard,
  resolveNavigation,
  unauthorizedRedirect,
  type RouteFlags,
  type SessionState,
} from '@/shared/router/guard'
import { useSessionStore } from '@/modules/identity/application/sessionStore'
import { ApiError } from '@/shared/api/error'

// shared/router may reach a module only through application/ and presentation/
// (dependency-cruiser), so this spec mocks the repository by path and touches
// the persisted token through localStorage rather than importing infrastructure.
const { currentUser } = vi.hoisted(() => ({ currentUser: vi.fn() }))

vi.mock('@/modules/identity/infrastructure/HttpAuthRepository', () => ({
  authRepository: { login: vi.fn(), logout: vi.fn(), currentUser },
}))

const TOKEN_KEY = 'quimica.auth.token'
const tokenStorage = {
  write: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  read: () => localStorage.getItem(TOKEN_KEY),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

const ANA = { userId: 'u-1', name: 'Ana', login: 'ana@escola.br', role: 'admin', mustChangePassword: false }

describe('resolveNavigation', () => {
  const flags = (overrides: Partial<RouteFlags> = {}): RouteFlags => ({
    requiresAuth: true,
    guestOnly: false,
    roles: null,
    allowsPendingPassword: false,
    ...overrides,
  })
  const session = (overrides: Partial<SessionState> = {}): SessionState => ({
    hasSession: true,
    expired: false,
    role: 'teacher',
    mustChangePassword: false,
    ...overrides,
  })

  it('sends a visitor without a session from a protected route to login', () => {
    expect(resolveNavigation(flags(), session({ hasSession: false, role: null }), '/classrooms'))
      .toEqual({ path: '/login', query: { redirect: '/classrooms' } })
  })

  it('tells the login page why when the session was just rejected', () => {
    expect(resolveNavigation(flags(), session({ hasSession: false, role: null, expired: true }), '/classrooms'))
      .toEqual({ path: '/login', query: { redirect: '/classrooms', reason: 'expired' } })
  })

  it('sends a known session away from the login page to its home', () => {
    expect(resolveNavigation(flags({ requiresAuth: false, guestOnly: true }), session({ role: 'student' }), '/login'))
      .toEqual({ path: '/my-classrooms' })
  })

  it('sends a session with an unknown profile away from login to the neutral home', () => {
    expect(resolveNavigation(flags({ requiresAuth: false, guestOnly: true }), session({ role: null }), '/login'))
      .toEqual({ path: '/' })
  })

  it('forces a pending password change before anything else', () => {
    expect(resolveNavigation(flags({ roles: ['admin', 'teacher'] }), session({ mustChangePassword: true }), '/classrooms'))
      .toEqual({ path: '/change-password' })
  })

  it('lets a pending password change reach the change-password page', () => {
    expect(resolveNavigation(flags({ allowsPendingPassword: true }), session({ mustChangePassword: true }), '/change-password'))
      .toBe(true)
  })

  it('sends a completed password change away from the change-password page only when forced there', () => {
    // The page is also reachable voluntarily from the account menu.
    expect(resolveNavigation(flags({ allowsPendingPassword: true }), session(), '/change-password')).toBe(true)
  })

  it('redirects a wrong role to its own home, not to an error', () => {
    expect(resolveNavigation(flags({ roles: ['admin'] }), session({ role: 'teacher' }), '/teachers'))
      .toEqual({ path: '/classrooms' })
    expect(resolveNavigation(flags({ roles: ['admin', 'teacher'] }), session({ role: 'student' }), '/classrooms'))
      .toEqual({ path: '/my-classrooms' })
  })

  it('lets an unknown profile through a role-restricted route so the page can show its own retry', () => {
    expect(resolveNavigation(flags({ roles: ['admin'] }), session({ role: null }), '/teachers')).toBe(true)
  })

  it('lets the right role through', () => {
    expect(resolveNavigation(flags({ roles: ['admin'] }), session({ role: 'admin' }), '/teachers')).toBe(true)
  })
})

describe('homeFor', () => {
  it('maps each role to its landing page', () => {
    expect(homeFor('admin')).toBe('/classrooms')
    expect(homeFor('teacher')).toBe('/classrooms')
    expect(homeFor('student')).toBe('/my-classrooms')
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
        { path: '/', component: Stub, meta: { requiresAuth: true } },
        { path: '/login', component: Stub, meta: { guestOnly: true } },
        { path: '/change-password', component: Stub, meta: { requiresAuth: true, allowsPendingPassword: true } },
        { path: '/classrooms', component: Stub, meta: { requiresAuth: true, roles: ['admin', 'teacher'] } },
        { path: '/my-classrooms', component: Stub, meta: { requiresAuth: true, roles: ['student'] } },
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

    await router.push('/classrooms')

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query).toEqual({ redirect: '/classrooms', reason: 'expired' })
    expect(useSessionStore().hasSession).toBe(false)
    expect(tokenStorage.read()).toBeNull()
    // Only the test's own push: onUnauthorized left the first-load redirect to the guard.
    expect(push).toHaveBeenCalledTimes(1)
  })

  it('keeps the token and loads the protected route when restore cannot reach the server', async () => {
    tokenStorage.write('persisted')
    currentUser.mockRejectedValue(new ApiError('api.network_unavailable'))

    await router.push('/classrooms')

    expect(router.currentRoute.value.path).toBe('/classrooms')
    expect(useSessionStore().hasSession).toBe(true)
    expect(tokenStorage.read()).toBe('persisted')
  })

  it('sends a signed-in user to login with the expiry notice on a mid-session 401', async () => {
    tokenStorage.write('valid')
    currentUser.mockResolvedValue(ANA)
    await router.push('/classrooms')
    expect(router.currentRoute.value.path).toBe('/classrooms')

    // e.g. GET /classrooms answered 401 because the token was revoked meanwhile.
    onUnauthorized()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/login'))

    expect(router.currentRoute.value.query).toEqual({ reason: 'expired' })
    expect(useSessionStore().hasSession).toBe(false)
  })

  it('ends on the expiry notice when a session that started offline is rejected on a later navigation', async () => {
    tokenStorage.write('revoked')
    currentUser.mockRejectedValueOnce(new ApiError('api.network_unavailable'))
    await router.push('/classrooms')
    expect(router.currentRoute.value.path).toBe('/classrooms')

    // Back online: the guard retries restore() on the next navigation and the
    // server rejects the token. Here onUnauthorized (current route requires auth)
    // and the guard both redirect; whichever wins, the notice must survive.
    currentUser.mockImplementationOnce(rejectLikeTheTransport)
    await router.push('/login').catch(() => undefined)
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/login'))

    expect(router.currentRoute.value.query.reason).toBe('expired')
    expect(useSessionStore().hasSession).toBe(false)
  })

  it('sends a visitor without a token to login without the expiry notice', async () => {
    await router.push('/classrooms')

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query).toEqual({ redirect: '/classrooms' })
    expect(currentUser).not.toHaveBeenCalled()
  })

  it('lands a restored student who opens a staff URL on their own home', async () => {
    tokenStorage.write('valid')
    currentUser.mockResolvedValue({ ...ANA, role: 'student' })

    await router.push('/classrooms')

    expect(router.currentRoute.value.path).toBe('/my-classrooms')
  })

  it('lands a restored user with a pending password on the change page, whatever they opened', async () => {
    tokenStorage.write('valid')
    currentUser.mockResolvedValue({ ...ANA, mustChangePassword: true })

    await router.push('/classrooms')

    expect(router.currentRoute.value.path).toBe('/change-password')
  })
})
