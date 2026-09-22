import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSessionStore } from '@/modules/identity/application/sessionStore'
import { authRepository } from '@/modules/identity/infrastructure/HttpAuthRepository'
import { tokenStorage } from '@/modules/identity/infrastructure/persistence/tokenStorage'
import { ApiError } from '@/shared/api/error'

vi.mock('@/modules/identity/infrastructure/HttpAuthRepository', () => ({
  authRepository: { login: vi.fn(), logout: vi.fn(), currentUser: vi.fn(), changePassword: vi.fn() },
}))

describe('sessionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    tokenStorage.clear()
  })

  it('starts unauthenticated', () => {
    expect(useSessionStore().isAuthenticated).toBe(false)
  })

  it('stores the session and persists the token on login', async () => {
    vi.mocked(authRepository.login).mockResolvedValue({
      userId: 'u-1', name: 'Ana', login: 'ana@escola.br', role: 'admin', mustChangePassword: false, token: 'tok',
    })

    const store = useSessionStore()
    await store.login({ login: 'ana@escola.br', password: 'password' })

    expect(store.isAuthenticated).toBe(true)
    expect(store.user?.name).toBe('Ana')
    expect(tokenStorage.read()).toBe('tok')
  })

  it('leaves the store clean when login fails', async () => {
    vi.mocked(authRepository.login).mockRejectedValue(new ApiError('identity.invalid_credentials', {}, 401))

    const store = useSessionStore()

    await expect(store.login({ login: 'ana@escola.br', password: 'wrong' })).rejects.toBeInstanceOf(ApiError)
    expect(store.isAuthenticated).toBe(false)
    expect(store.token).toBeNull()
    expect(store.user).toBeNull()
    expect(tokenStorage.read()).toBeNull()
  })

  it('clears everything on logout', async () => {
    vi.mocked(authRepository.login).mockResolvedValue({
      userId: 'u-1', name: 'Ana', login: 'ana@escola.br', role: 'admin', mustChangePassword: false, token: 'tok',
    })
    vi.mocked(authRepository.logout).mockResolvedValue(undefined)

    const store = useSessionStore()
    await store.login({ login: 'ana@escola.br', password: 'password' })
    await store.logout()

    expect(store.isAuthenticated).toBe(false)
    expect(tokenStorage.read()).toBeNull()
  })

  it('clears local state even when the logout request fails', async () => {
    vi.mocked(authRepository.login).mockResolvedValue({
      userId: 'u-1', name: 'Ana', login: 'ana@escola.br', role: 'admin', mustChangePassword: false, token: 'tok',
    })
    vi.mocked(authRepository.logout).mockRejectedValue(new ApiError('api.network_unavailable'))

    const store = useSessionStore()
    await store.login({ login: 'ana@escola.br', password: 'password' })
    await store.logout()

    expect(store.isAuthenticated).toBe(false)
    expect(tokenStorage.read()).toBeNull()
  })

  it('restores a persisted token on boot', async () => {
    tokenStorage.write('persisted')
    vi.mocked(authRepository.currentUser).mockResolvedValue({
      userId: 'u-9', name: 'Ana', login: 'ana@escola.br', role: 'admin', mustChangePassword: false,
    })

    const store = useSessionStore()
    await store.restore()

    expect(store.isAuthenticated).toBe(true)
    expect(store.user?.userId).toBe('u-9')
  })

  it('discards a persisted token the server rejects', async () => {
    tokenStorage.write('stale')
    vi.mocked(authRepository.currentUser).mockRejectedValue(new ApiError('auth.unauthenticated', {}, 401))

    const store = useSessionStore()
    const outcome = await store.restore()

    expect(outcome).toBe('rejected')
    expect(store.isAuthenticated).toBe(false)
    expect(store.hasSession).toBe(false)
    expect(tokenStorage.read()).toBeNull()
  })

  it.each([
    ['the network is down', new ApiError('api.network_unavailable')],
    ['the request times out', new ApiError('api.request_timeout')],
    ['the server fails', new ApiError('system.unexpected_error', {}, 500)],
  ])('keeps the persisted token when restore fails because %s', async (_reason, failure) => {
    // An installed PWA reloaded offline, or a timeout on school Wi-Fi, must not
    // sign the student out: only the server saying 401 ends a session.
    tokenStorage.write('persisted')
    vi.mocked(authRepository.currentUser).mockRejectedValue(failure)

    const store = useSessionStore()
    const outcome = await store.restore()

    expect(outcome).toBe('unavailable')
    expect(store.hasSession).toBe(true)
    expect(store.isAuthenticated).toBe(false)
    expect(store.token).toBe('persisted')
    expect(tokenStorage.read()).toBe('persisted')
  })

  it('has a session as soon as a token exists, before the user is known', () => {
    tokenStorage.write('persisted')

    const store = useSessionStore()

    expect(store.hasSession).toBe(true)
    expect(store.isAuthenticated).toBe(false)
  })

  it('reports a successful restore', async () => {
    tokenStorage.write('persisted')
    vi.mocked(authRepository.currentUser).mockResolvedValue({
      userId: 'u-9', name: 'Ana', login: 'ana@escola.br', role: 'admin', mustChangePassword: false,
    })

    await expect(useSessionStore().restore()).resolves.toBe('restored')
  })

  it('coalesces concurrent restore() calls into a single request', async () => {
    tokenStorage.write('persisted')
    vi.mocked(authRepository.currentUser).mockResolvedValue({
      userId: 'u-9', name: 'Ana', login: 'ana@escola.br', role: 'admin', mustChangePassword: false,
    })

    const store = useSessionStore()
    await Promise.all([store.restore(), store.restore()])

    expect(authRepository.currentUser).toHaveBeenCalledTimes(1)
    expect(store.isAuthenticated).toBe(true)
  })

  it('does not call currentUser when there is no persisted token', async () => {
    const store = useSessionStore()
    const outcome = await store.restore()

    expect(outcome).toBe('skipped')
    expect(authRepository.currentUser).not.toHaveBeenCalled()
  })

  it('exposes the role and the password-change flag of the signed-in user', async () => {
    vi.mocked(authRepository.login).mockResolvedValue({
      userId: 'u-2', name: 'Diego', login: 'diego.souza', role: 'student', mustChangePassword: true, token: 'tok',
    })

    const store = useSessionStore()
    await store.login({ login: 'diego.souza', password: 'Temp2345' })

    expect(store.role).toBe('student')
    expect(store.mustChangePassword).toBe(true)
  })

  it('clears the password-change flag after a successful change', async () => {
    vi.mocked(authRepository.login).mockResolvedValue({
      userId: 'u-2', name: 'Diego', login: 'diego.souza', role: 'student', mustChangePassword: true, token: 'tok',
    })
    vi.mocked(authRepository.changePassword).mockResolvedValue()

    const store = useSessionStore()
    await store.login({ login: 'diego.souza', password: 'Temp2345' })
    await store.changePassword({ currentPassword: 'Temp2345', newPassword: 'minha-senha' })

    expect(store.mustChangePassword).toBe(false)
    expect(store.token).toBe('tok')
  })

  it('keeps the flag when the change is rejected', async () => {
    vi.mocked(authRepository.login).mockResolvedValue({
      userId: 'u-2', name: 'Diego', login: 'diego.souza', role: 'student', mustChangePassword: true, token: 'tok',
    })
    vi.mocked(authRepository.changePassword).mockRejectedValue(new ApiError('identity.current_password_invalid', {}, 422))

    const store = useSessionStore()
    await store.login({ login: 'diego.souza', password: 'Temp2345' })

    await expect(store.changePassword({ currentPassword: 'x', newPassword: 'minha-senha' })).rejects.toBeInstanceOf(ApiError)
    expect(store.mustChangePassword).toBe(true)
  })
})
