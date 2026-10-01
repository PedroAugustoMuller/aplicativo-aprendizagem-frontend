import { beforeEach, describe, expect, it, vi } from 'vitest'
import { teacherRepository } from '@/modules/identity/infrastructure/HttpTeacherRepository'
import { identityRequests } from '@/modules/identity/infrastructure/client/requests'

vi.mock('@/modules/identity/infrastructure/client/requests', () => ({
  identityRequests: {
    listTeachers: vi.fn(),
    createTeacher: vi.fn(),
    resetTeacherPassword: vi.fn(),
    deactivateTeacher: vi.fn(),
    reactivateTeacher: vi.fn(),
  },
}))

const ISSUED = {
  id: 't-1', name: 'Bruno', login: 'bruno@escola.br', role: 'teacher',
  must_change_password: true, active: true, temporary_password: 'Abc23456',
}

describe('HttpTeacherRepository', () => {
  beforeEach(() => vi.resetAllMocks())

  it('maps the list, reading the login as the email', async () => {
    vi.mocked(identityRequests.listTeachers).mockResolvedValue([
      { id: 't-1', name: 'Bruno', login: 'bruno@escola.br', must_change_password: false, active: true },
    ])

    await expect(teacherRepository.list()).resolves.toEqual([
      { id: 't-1', name: 'Bruno', email: 'bruno@escola.br', mustChangePassword: false, active: true },
    ])
  })

  it('creates under the client id and returns the temporary password', async () => {
    vi.mocked(identityRequests.createTeacher).mockResolvedValue(ISSUED)

    await expect(teacherRepository.create({ id: 't-1', name: 'Bruno', email: 'bruno@escola.br' }))
      .resolves.toEqual({ id: 't-1', name: 'Bruno', login: 'bruno@escola.br', temporaryPassword: 'Abc23456' })
    expect(identityRequests.createTeacher).toHaveBeenCalledWith({ id: 't-1', name: 'Bruno', email: 'bruno@escola.br' })
  })

  it('resets a password', async () => {
    vi.mocked(identityRequests.resetTeacherPassword).mockResolvedValue(ISSUED)

    await expect(teacherRepository.resetPassword('t-1')).resolves.toMatchObject({ temporaryPassword: 'Abc23456' })
  })

  it('deactivates and reactivates through their own endpoints', async () => {
    vi.mocked(identityRequests.deactivateTeacher).mockResolvedValue(ISSUED)
    vi.mocked(identityRequests.reactivateTeacher).mockResolvedValue(ISSUED)

    await teacherRepository.setActive('t-1', false)
    await teacherRepository.setActive('t-1', true)

    expect(identityRequests.deactivateTeacher).toHaveBeenCalledWith('t-1')
    expect(identityRequests.reactivateTeacher).toHaveBeenCalledWith('t-1')
  })
})
