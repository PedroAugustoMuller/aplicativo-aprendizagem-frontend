import { beforeEach, describe, expect, it, vi } from 'vitest'
import { studentRepository } from '@/modules/identity/infrastructure/HttpStudentRepository'
import { identityRequests } from '@/modules/identity/infrastructure/client/requests'

vi.mock('@/modules/identity/infrastructure/client/requests', () => ({
  identityRequests: {
    listStudents: vi.fn(),
    createStudents: vi.fn(),
    unenrolStudent: vi.fn(),
    resetStudentPassword: vi.fn(),
    deactivateStudent: vi.fn(),
    reactivateStudent: vi.fn(),
    listCredentials: vi.fn(),
  },
}))

const ISSUED = {
  id: 's-1', name: 'Ana', login: 'ana.lima', role: 'student',
  must_change_password: true, active: true, temporary_password: 'Abc23456',
}

describe('HttpStudentRepository', () => {
  beforeEach(() => vi.resetAllMocks())

  it('maps a class roster, reading the login as the username', async () => {
    vi.mocked(identityRequests.listStudents).mockResolvedValue([
      { id: 's-1', name: 'Ana', login: 'ana.lima', must_change_password: true, active: true },
    ])

    await expect(studentRepository.listByClassroom('c-1')).resolves.toEqual([
      { id: 's-1', name: 'Ana', username: 'ana.lima', mustChangePassword: true, active: true },
    ])
    expect(identityRequests.listStudents).toHaveBeenCalledWith('c-1')
  })

  it('creates a batch under the client ids', async () => {
    vi.mocked(identityRequests.createStudents).mockResolvedValue([ISSUED])

    await expect(studentRepository.createMany('c-1', [{ id: 's-1', name: 'Ana' }]))
      .resolves.toEqual([{ id: 's-1', name: 'Ana', login: 'ana.lima', temporaryPassword: 'Abc23456' }])
    expect(identityRequests.createStudents).toHaveBeenCalledWith('c-1', [{ id: 's-1', name: 'Ana' }])
  })

  it('unenrols, resets and changes status through their endpoints', async () => {
    vi.mocked(identityRequests.unenrolStudent).mockResolvedValue({
      id: 'c-1', name: 'Q', subject_id: 's', teacher_ids: [], student_count: 0, active: true,
    })
    vi.mocked(identityRequests.resetStudentPassword).mockResolvedValue(ISSUED)
    vi.mocked(identityRequests.deactivateStudent).mockResolvedValue(ISSUED)
    vi.mocked(identityRequests.reactivateStudent).mockResolvedValue(ISSUED)

    await studentRepository.unenrol('c-1', 's-1')
    await expect(studentRepository.resetPassword('s-1')).resolves.toMatchObject({ temporaryPassword: 'Abc23456' })
    await studentRepository.setActive('s-1', false)
    await studentRepository.setActive('s-1', true)

    expect(identityRequests.unenrolStudent).toHaveBeenCalledWith('c-1', 's-1')
    expect(identityRequests.deactivateStudent).toHaveBeenCalledWith('s-1')
    expect(identityRequests.reactivateStudent).toHaveBeenCalledWith('s-1')
  })

  it('maps the access slips', async () => {
    vi.mocked(identityRequests.listCredentials).mockResolvedValue([
      { user_id: 's-1', name: 'Ana', login: 'ana.lima', temporary_password: 'Abc23456' },
    ])

    await expect(studentRepository.credentials('c-1')).resolves.toEqual([
      { userId: 's-1', name: 'Ana', username: 'ana.lima', temporaryPassword: 'Abc23456' },
    ])
  })
})
