import { beforeEach, describe, expect, it, vi } from 'vitest'
import { studentRepository } from '@/modules/identity/infrastructure/HttpStudentRepository'
import { identityRequests } from '@/modules/identity/infrastructure/client/requests'
import { ApiError } from '@/shared/api/error'

vi.mock('@/modules/identity/infrastructure/client/requests', () => ({
  identityRequests: {
    listClassroomStudents: vi.fn(),
    createClassroomStudents: vi.fn(),
    enrolClassroomStudent: vi.fn(),
    unenrolClassroomStudent: vi.fn(),
    resetStudentPassword: vi.fn(),
    deactivateStudent: vi.fn(),
    reactivateStudent: vi.fn(),
    listClassroomCredentials: vi.fn(),
  },
}))

describe('HttpStudentRepository', () => {
  beforeEach(() => vi.resetAllMocks())

  it('maps the response into account summaries, sorted by name', async () => {
    vi.mocked(identityRequests.listClassroomStudents).mockResolvedValue([
      { id: 's-2', name: 'Diego', login: 'diego.souza', must_change_password: true, active: true },
      { id: 's-1', name: 'Carla', login: 'carla.dias', must_change_password: false, active: true },
    ])

    const students = await studentRepository.listByClassroom('c-1')

    expect(identityRequests.listClassroomStudents).toHaveBeenCalledWith('c-1')
    expect(students.map((student) => student.id)).toEqual(['s-1', 's-2'])
    expect(students[0]).toEqual({ id: 's-1', name: 'Carla', login: 'carla.dias', mustChangePassword: false, active: true })
  })

  it('creates students in a classroom by posting the given rows, in order', async () => {
    vi.mocked(identityRequests.createClassroomStudents).mockResolvedValue([
      { id: 's-1', name: 'Ana', login: 'ana.souza', role: 'student', must_change_password: true, active: true, temporary_password: 'Temp1111' },
      { id: 's-2', name: 'Bia', login: 'bia.lima', role: 'student', must_change_password: true, active: true, temporary_password: 'Temp2222' },
    ])

    const rows = [{ id: 's-1', name: 'Ana' }, { id: 's-2', name: 'Bia' }]
    const created = await studentRepository.createInClassroom('c-1', rows)

    expect(identityRequests.createClassroomStudents).toHaveBeenCalledWith('c-1', { students: rows })
    expect(created.map((student) => student.id)).toEqual(['s-1', 's-2'])
    expect(created[0]?.temporaryPassword).toBe('Temp1111')
  })

  it('enrols a student in a classroom', async () => {
    vi.mocked(identityRequests.enrolClassroomStudent).mockResolvedValue({
      id: 'c-2', name: 'Química 2', subject_id: 's-1', teacher_ids: [], student_count: 1, active: true,
    })

    await studentRepository.enrol('c-2', 's-1')

    expect(identityRequests.enrolClassroomStudent).toHaveBeenCalledWith('c-2', 's-1')
  })

  it('unenrols a student from a classroom', async () => {
    vi.mocked(identityRequests.unenrolClassroomStudent).mockResolvedValue({
      id: 'c-1', name: 'Química 1', subject_id: 's-1', teacher_ids: [], student_count: 0, active: true,
    })

    await studentRepository.unenrol('c-1', 's-1')

    expect(identityRequests.unenrolClassroomStudent).toHaveBeenCalledWith('c-1', 's-1')
  })

  it('resets a password by id', async () => {
    vi.mocked(identityRequests.resetStudentPassword).mockResolvedValue({
      id: 's-1', name: 'Carla', login: 'carla.dias', role: 'student', must_change_password: true, active: true, temporary_password: 'Temp5678',
    })

    const account = await studentRepository.resetPassword('s-1')

    expect(identityRequests.resetStudentPassword).toHaveBeenCalledWith('s-1')
    expect(account.temporaryPassword).toBe('Temp5678')
  })

  it('deactivates a student when setActive(id, false)', async () => {
    vi.mocked(identityRequests.deactivateStudent).mockResolvedValue({
      id: 's-1', name: 'Carla', login: 'carla.dias', role: 'student', must_change_password: false, active: false, temporary_password: null,
    })

    const account = await studentRepository.setActive('s-1', false)

    expect(identityRequests.deactivateStudent).toHaveBeenCalledWith('s-1')
    expect(identityRequests.reactivateStudent).not.toHaveBeenCalled()
    expect(account.active).toBe(false)
  })

  it('reactivates a student when setActive(id, true)', async () => {
    vi.mocked(identityRequests.reactivateStudent).mockResolvedValue({
      id: 's-1', name: 'Carla', login: 'carla.dias', role: 'student', must_change_password: false, active: true, temporary_password: null,
    })

    const account = await studentRepository.setActive('s-1', true)

    expect(identityRequests.reactivateStudent).toHaveBeenCalledWith('s-1')
    expect(identityRequests.deactivateStudent).not.toHaveBeenCalled()
    expect(account.active).toBe(true)
  })

  it('maps credential slips from the classroom credentials endpoint', async () => {
    vi.mocked(identityRequests.listClassroomCredentials).mockResolvedValue([
      { user_id: 's-1', name: 'Carla', login: 'carla.dias', temporary_password: 'Temp1234' },
    ])

    const slips = await studentRepository.credentials('c-1')

    expect(identityRequests.listClassroomCredentials).toHaveBeenCalledWith('c-1')
    expect(slips).toEqual([{ userId: 's-1', name: 'Carla', login: 'carla.dias', temporaryPassword: 'Temp1234' }])
  })

  it('lets an ApiError propagate untouched', async () => {
    vi.mocked(identityRequests.listClassroomStudents).mockRejectedValue(new ApiError('auth.unauthenticated', {}, 401))

    await expect(studentRepository.listByClassroom('c-1')).rejects.toBeInstanceOf(ApiError)
  })
})
