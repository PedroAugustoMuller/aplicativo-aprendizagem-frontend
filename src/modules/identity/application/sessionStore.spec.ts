import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSessionStore } from '@/modules/identity/application/sessionStore'
import { authRepository } from '@/modules/identity/infrastructure/HttpAuthRepository'
import { tokenStorage } from '@/modules/identity/infrastructure/persistence/tokenStorage'
import { ApiError } from '@/shared/api/error'

vi.mock('@/modules/identity/infrastructure/HttpAuthRepository', () => ({
  authRepository: { login: vi.fn(), logout: vi.fn(), currentUser: vi.fn(), changePassword: vi.fn() },
}))

const ANA = {
  userId: 'u-1',
  name: 'Ana',
  login: 'ana@escola.br',
  role: 'admin',
  mustChangePassword: false,
} as const
const ANA_SESSION = { ...ANA, token: 'tok' }
const ANA_CREDENTIALS = { login: 'ana@escola.br', password: 'password' }

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
    vi.mocked(authRepository.login).mockResolvedValue(ANA_SESSION)

    const store = useSessionStore()
    await store.login(ANA_CREDENTIALS)

    expect(store.isAuthenticated).toBe(true)
    expect(store.user?.name).toBe('Ana')
    expect(tokenStorage.read()).toBe('tok')
  })

  it('keeps the full user, but not the token, as the user', async () => {
    vi.mocked(authRepository.login).mockResolvedValue(ANA_SESSION)

    const store = useSessionStore()
    await store.login(ANA_CREDENTIALS)

    expect(store.user).toEqual(ANA)
    expect(store.user).not.toHaveProperty('token')
    expect(store.token).toBe('tok')
  })

  it('knows when the user must change a temporary password', async () => {
    vi.mocked(authRepository.login).mockResolvedValue({ ...ANA_SESSION, mustChangePassword: true })

    const store = useSessionStore()
    expect(store.mustChangePassword).toBe(false)

    await store.login(ANA_CREDENTIALS)

    expect(store.mustChangePassword).toBe(true)
  })

  it('clears the requirement and keeps the session after a password change', async () => {
    vi.mocked(authRepository.login).mockResolvedValue({ ...ANA_SESSION, mustChangePassword: true })
    vi.mocked(authRepository.changePassword).mockResolvedValue(undefined)

    const store = useSessionStore()
    await store.login(ANA_CREDENTIALS)
    await store.changePassword({ currentPassword: 'password', newPassword: 'nova-senha-1' })

    expect(authRepository.changePassword).toHaveBeenCalledWith({ currentPassword: 'password', newPassword: 'nova-senha-1' })
    expect(store.mustChangePassword).toBe(false)
    expect(store.token).toBe('tok')
    expect(tokenStorage.read()).toBe('tok')
  })

  it('leaves the requirement in place when the change is rejected', async () => {
    vi.mocked(authRepository.login).mockResolvedValue({ ...ANA_SESSION, mustChangePassword: true })
    vi.mocked(authRepository.changePassword).mockRejectedValue(new ApiError('identity.current_password_invalid', {}, 422))

    const store = useSessionStore()
    await store.login(ANA_CREDENTIALS)

    await expect(store.changePassword({ currentPassword: 'x', newPassword: 'nova-senha-1' }))
      .rejects.toMatchObject({ code: 'identity.current_password_invalid' })
    expect(store.mustChangePassword).toBe(true)
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
    vi.mocked(authRepository.login).mockResolvedValue(ANA_SESSION)
    vi.mocked(authRepository.logout).mockResolvedValue(undefined)

    const store = useSessionStore()
    await store.login(ANA_CREDENTIALS)
    await store.logout()

    expect(store.isAuthenticated).toBe(false)
    expect(tokenStorage.read()).toBeNull()
  })

  it('clears local state even when the logout request fails', async () => {
    vi.mocked(authRepository.login).mockResolvedValue(ANA_SESSION)
    vi.mocked(authRepository.logout).mockRejectedValue(new ApiError('api.network_unavailable'))

    const store = useSessionStore()
    await store.login(ANA_CREDENTIALS)
    await store.logout()

    expect(store.isAuthenticated).toBe(false)
    expect(tokenStorage.read()).toBeNull()
  })

  it('restores a persisted token on boot', async () => {
    tokenStorage.write('persisted')
    vi.mocked(authRepository.currentUser).mockResolvedValue({ ...ANA, userId: 'u-9' })

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
    vi.mocked(authRepository.currentUser).mockResolvedValue({ ...ANA, userId: 'u-9' })

    await expect(useSessionStore().restore()).resolves.toBe('restored')
  })

  it('coalesces concurrent restore() calls into a single request', async () => {
    tokenStorage.write('persisted')
    vi.mocked(authRepository.currentUser).mockResolvedValue({ ...ANA, userId: 'u-9' })

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

  it('remembers who confirmed the session, for an offline reload', async () => {
    vi.mocked(authRepository.login).mockResolvedValue(ANA_SESSION)
    await useSessionStore().login(ANA_CREDENTIALS)

    // A reload: a fresh store, the server not reached yet.
    setActivePinia(createPinia())
    const store = useSessionStore()

    expect(store.user).toBeNull()
    expect(store.knownUser).toEqual(ANA)
  })

  it('updates the remembered user when the server confirms the session', async () => {
    tokenStorage.write('persisted')
    vi.mocked(authRepository.currentUser).mockResolvedValue({ ...ANA, name: 'Ana Maria' })

    await useSessionStore().restore()
    setActivePinia(createPinia())

    expect(useSessionStore().knownUser?.name).toBe('Ana Maria')
  })

  it('forgets the remembered user when the session ends', async () => {
    vi.mocked(authRepository.login).mockResolvedValue(ANA_SESSION)
    const store = useSessionStore()
    await store.login(ANA_CREDENTIALS)

    store.clear()
    setActivePinia(createPinia())

    expect(useSessionStore().knownUser).toBeNull()
  })

  it('ignores a remembered user that is not well formed', () => {
    localStorage.setItem('dp2.auth.user', '{"userId":1}')

    expect(useSessionStore().knownUser).toBeNull()
  })
})
