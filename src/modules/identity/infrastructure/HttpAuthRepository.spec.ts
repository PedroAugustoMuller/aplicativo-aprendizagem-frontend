import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authRepository } from '@/modules/identity/infrastructure/HttpAuthRepository'
import { identityRequests } from '@/modules/identity/infrastructure/client/requests'
import { ApiError } from '@/shared/api/error'

vi.mock('@/modules/identity/infrastructure/client/requests', () => ({
  identityRequests: { login: vi.fn(), logout: vi.fn(), currentUser: vi.fn() },
}))

const ANA_RESPONSE = {
  id: 'u-1',
  name: 'Professora Ana',
  login: 'ana@escola.br',
  role: 'admin',
  must_change_password: false,
}

describe('HttpAuthRepository', () => {
  beforeEach(() => vi.resetAllMocks())

  it('posts the identifier under "login"', async () => {
    vi.mocked(identityRequests.login).mockResolvedValue({ ...ANA_RESPONSE, token: 'tok' })

    await authRepository.login({ login: 'ana@escola.br', password: 'password' })

    expect(identityRequests.login).toHaveBeenCalledWith({ login: 'ana@escola.br', password: 'password' })
  })

  it('maps the network response onto the domain session', async () => {
    vi.mocked(identityRequests.login).mockResolvedValue({ ...ANA_RESPONSE, token: 'tok' })

    await expect(authRepository.login({ login: 'ana@escola.br', password: 'password' })).resolves.toEqual({
      userId: 'u-1',
      name: 'Professora Ana',
      login: 'ana@escola.br',
      role: 'admin',
      mustChangePassword: false,
      token: 'tok',
    })
  })

  it('carries a pending password change into the domain', async () => {
    vi.mocked(identityRequests.login).mockResolvedValue({
      id: 'u-13', name: 'Diego Souza', login: 'diego.souza', role: 'student', must_change_password: true, token: 't',
    })

    const session = await authRepository.login({ login: 'diego.souza', password: 'Temp2345' })

    expect(session.role).toBe('student')
    expect(session.mustChangePassword).toBe(true)
    expect(session).not.toHaveProperty('must_change_password')
  })

  it('rejects a role the app does not know instead of leaking it into the domain', async () => {
    vi.mocked(identityRequests.login).mockResolvedValue({ ...ANA_RESPONSE, role: 'janitor', token: 't' })

    await expect(authRepository.login({ login: 'x', password: 'y' })).rejects.toMatchObject({
      code: 'api.unexpected_response',
    })
  })

  it('lets an ApiError propagate untouched', async () => {
    vi.mocked(identityRequests.login).mockRejectedValue(new ApiError('identity.invalid_credentials', {}, 401))

    await expect(authRepository.login({ login: 'a@b.c', password: 'wrong' })).rejects.toMatchObject({
      code: 'identity.invalid_credentials',
    })
  })

  it('maps the current user', async () => {
    vi.mocked(identityRequests.currentUser).mockResolvedValue({
      id: 'u-12', name: 'Carla Dias', login: 'carla.dias', role: 'student', must_change_password: false,
    })

    await expect(authRepository.currentUser()).resolves.toEqual({
      userId: 'u-12', name: 'Carla Dias', login: 'carla.dias', role: 'student', mustChangePassword: false,
    })
  })
})
