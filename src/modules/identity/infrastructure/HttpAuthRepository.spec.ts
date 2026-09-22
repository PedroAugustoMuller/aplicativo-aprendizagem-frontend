import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authRepository } from '@/modules/identity/infrastructure/HttpAuthRepository'
import { identityRequests } from '@/modules/identity/infrastructure/client/requests'
import { ApiError } from '@/shared/api/error'

vi.mock('@/modules/identity/infrastructure/client/requests', () => ({
  identityRequests: {
    login: vi.fn(),
    logout: vi.fn(),
    currentUser: vi.fn(),
    changePassword: vi.fn(),
  },
}))

describe('HttpAuthRepository', () => {
  beforeEach(() => vi.resetAllMocks())

  it('maps the network response onto the domain session', async () => {
    vi.mocked(identityRequests.login).mockResolvedValue({
      id: 'u-1',
      name: 'Professora Ana',
      login: 'ana@escola.br',
      role: 'admin',
      must_change_password: false,
      token: 'tok',
    })

    const session = await authRepository.login({ login: 'ana@escola.br', password: 'password' })

    expect(session).toEqual({
      userId: 'u-1',
      name: 'Professora Ana',
      login: 'ana@escola.br',
      role: 'admin',
      mustChangePassword: false,
      token: 'tok',
    })
  })

  it('renames id to userId so the API shape does not dictate the domain', async () => {
    vi.mocked(identityRequests.login).mockResolvedValue({
      id: 'u-2', name: 'A', login: 'a', role: 'teacher', must_change_password: false, token: 't',
    })

    const session = await authRepository.login({ login: 'a', password: 'x' })

    expect(session).not.toHaveProperty('id')
    expect(session.userId).toBe('u-2')
  })

  it('maps a student logging in by username and carrying the must-change flag', async () => {
    vi.mocked(identityRequests.login).mockResolvedValue({
      id: 'u-1',
      name: 'Diego Souza',
      login: 'diego.souza',
      role: 'student',
      must_change_password: true,
      token: 'tok',
    })

    const session = await authRepository.login({ login: 'diego.souza', password: 'Temp2345' })

    expect(session).toEqual({
      userId: 'u-1',
      name: 'Diego Souza',
      login: 'diego.souza',
      role: 'student',
      mustChangePassword: true,
      token: 'tok',
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
      id: 'u-3', name: 'B', login: 'b', role: 'teacher', must_change_password: false,
    })

    await expect(authRepository.currentUser()).resolves.toEqual({
      userId: 'u-3', name: 'B', login: 'b', role: 'teacher', mustChangePassword: false,
    })
  })

  it('rejects a role the domain does not know', async () => {
    vi.mocked(identityRequests.currentUser).mockResolvedValue({
      id: 'u-9', name: 'X', login: 'x', role: 'janitor', must_change_password: false,
    })

    await expect(authRepository.currentUser()).rejects.toMatchObject({ code: 'api.unexpected_response' })
  })

  it('sends the password change in the API field names', async () => {
    vi.mocked(identityRequests.changePassword).mockResolvedValue(null)

    await authRepository.changePassword({ currentPassword: 'old-pass', newPassword: 'new-pass-1' })

    expect(identityRequests.changePassword).toHaveBeenCalledWith({
      current_password: 'old-pass',
      new_password: 'new-pass-1',
    })
  })
})
