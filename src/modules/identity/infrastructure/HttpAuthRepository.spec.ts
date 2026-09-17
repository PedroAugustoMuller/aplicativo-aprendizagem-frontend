import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authRepository } from '@/modules/identity/infrastructure/HttpAuthRepository'
import { identityRequests } from '@/modules/identity/infrastructure/client/requests'
import { ApiError } from '@/shared/api/error'

vi.mock('@/modules/identity/infrastructure/client/requests', () => ({
  identityRequests: { login: vi.fn(), logout: vi.fn(), currentUser: vi.fn() },
}))

describe('HttpAuthRepository', () => {
  beforeEach(() => vi.resetAllMocks())

  it('maps the network response onto the domain session', async () => {
    vi.mocked(identityRequests.login).mockResolvedValue({
      id: 'u-1',
      name: 'Professora Ana',
      email: 'ana@escola.br',
      token: 'tok',
    })

    const session = await authRepository.login({ email: 'ana@escola.br', password: 'password' })

    expect(session).toEqual({
      userId: 'u-1',
      name: 'Professora Ana',
      email: 'ana@escola.br',
      token: 'tok',
    })
  })

  it('renames id to userId so the API shape does not dictate the domain', async () => {
    vi.mocked(identityRequests.login).mockResolvedValue({
      id: 'u-2', name: 'A', email: 'a@b.c', token: 't',
    })

    const session = await authRepository.login({ email: 'a@b.c', password: 'x' })

    expect(session).not.toHaveProperty('id')
    expect(session.userId).toBe('u-2')
  })

  it('lets an ApiError propagate untouched', async () => {
    vi.mocked(identityRequests.login).mockRejectedValue(new ApiError('identity.invalid_credentials', {}, 401))

    await expect(authRepository.login({ email: 'a@b.c', password: 'wrong' })).rejects.toMatchObject({
      code: 'identity.invalid_credentials',
    })
  })

  it('maps the current user', async () => {
    vi.mocked(identityRequests.currentUser).mockResolvedValue({ id: 'u-3', name: 'B', email: 'b@c.d' })

    await expect(authRepository.currentUser()).resolves.toEqual({
      userId: 'u-3', name: 'B', email: 'b@c.d',
    })
  })
})
