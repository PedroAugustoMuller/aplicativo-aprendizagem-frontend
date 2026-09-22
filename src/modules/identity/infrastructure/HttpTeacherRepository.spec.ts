import { beforeEach, describe, expect, it, vi } from 'vitest'
import { teacherRepository } from '@/modules/identity/infrastructure/HttpTeacherRepository'
import { identityRequests } from '@/modules/identity/infrastructure/client/requests'
import { ApiError } from '@/shared/api/error'

vi.mock('@/modules/identity/infrastructure/client/requests', () => ({
  identityRequests: {
    listTeachers: vi.fn(),
    createTeacher: vi.fn(),
    resetTeacherPassword: vi.fn(),
    deactivateTeacher: vi.fn(),
    reactivateTeacher: vi.fn(),
  },
}))

describe('HttpTeacherRepository', () => {
  beforeEach(() => vi.resetAllMocks())

  it('maps the response into account summaries, sorted by name', async () => {
    vi.mocked(identityRequests.listTeachers).mockResolvedValue([
      { id: 't-2', name: 'Zeca', login: 'zeca@escola.br', must_change_password: false, active: true },
      { id: 't-1', name: 'Ana', login: 'ana@escola.br', must_change_password: true, active: true },
    ])

    const teachers = await teacherRepository.list()

    expect(teachers.map((teacher) => teacher.id)).toEqual(['t-1', 't-2'])
    expect(teachers[0]).toEqual({ id: 't-1', name: 'Ana', login: 'ana@escola.br', mustChangePassword: true, active: true })
  })

  it('creates a teacher by posting the given id, name and email', async () => {
    vi.mocked(identityRequests.createTeacher).mockResolvedValue({
      id: 't-1',
      name: 'Bruno',
      login: 'bruno@escola.br',
      role: 'teacher',
      must_change_password: true,
      active: true,
      temporary_password: 'Temp1234',
    })

    const account = await teacherRepository.create({ id: 't-1', name: 'Bruno', email: 'bruno@escola.br' })

    expect(identityRequests.createTeacher).toHaveBeenCalledWith({ id: 't-1', name: 'Bruno', email: 'bruno@escola.br' })
    expect(account).toEqual({
      id: 't-1',
      name: 'Bruno',
      login: 'bruno@escola.br',
      role: 'teacher',
      mustChangePassword: true,
      active: true,
      temporaryPassword: 'Temp1234',
    })
  })

  it('resets a password by id', async () => {
    vi.mocked(identityRequests.resetTeacherPassword).mockResolvedValue({
      id: 't-1',
      name: 'Bruno',
      login: 'bruno@escola.br',
      role: 'teacher',
      must_change_password: true,
      active: true,
      temporary_password: 'Temp5678',
    })

    const account = await teacherRepository.resetPassword('t-1')

    expect(identityRequests.resetTeacherPassword).toHaveBeenCalledWith('t-1')
    expect(account.temporaryPassword).toBe('Temp5678')
    expect(account.mustChangePassword).toBe(true)
  })

  it('deactivates a teacher when setActive(id, false)', async () => {
    vi.mocked(identityRequests.deactivateTeacher).mockResolvedValue({
      id: 't-1',
      name: 'Bruno',
      login: 'bruno@escola.br',
      role: 'teacher',
      must_change_password: false,
      active: false,
      temporary_password: null,
    })

    const account = await teacherRepository.setActive('t-1', false)

    expect(identityRequests.deactivateTeacher).toHaveBeenCalledWith('t-1')
    expect(identityRequests.reactivateTeacher).not.toHaveBeenCalled()
    expect(account.active).toBe(false)
    expect(account.temporaryPassword).toBeNull()
  })

  it('reactivates a teacher when setActive(id, true)', async () => {
    vi.mocked(identityRequests.reactivateTeacher).mockResolvedValue({
      id: 't-1',
      name: 'Bruno',
      login: 'bruno@escola.br',
      role: 'teacher',
      must_change_password: false,
      active: true,
      temporary_password: null,
    })

    const account = await teacherRepository.setActive('t-1', true)

    expect(identityRequests.reactivateTeacher).toHaveBeenCalledWith('t-1')
    expect(identityRequests.deactivateTeacher).not.toHaveBeenCalled()
    expect(account.active).toBe(true)
  })

  it('lets an ApiError propagate untouched', async () => {
    vi.mocked(identityRequests.listTeachers).mockRejectedValue(new ApiError('auth.unauthenticated', {}, 401))

    await expect(teacherRepository.list()).rejects.toBeInstanceOf(ApiError)
  })
})
