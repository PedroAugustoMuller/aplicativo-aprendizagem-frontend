import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useRosterStore } from '@/modules/identity/application/rosterStore'
import { studentRepository } from '@/modules/identity/infrastructure/HttpStudentRepository'
import { ApiError } from '@/shared/api/error'
import type { AccountDetail, AccountSummary, CredentialSlip } from '@/modules/identity/domain/Account'

vi.mock('@/modules/identity/infrastructure/HttpStudentRepository', () => ({
  studentRepository: {
    listByClassroom: vi.fn(),
    createInClassroom: vi.fn(),
    enrol: vi.fn(),
    unenrol: vi.fn(),
    resetPassword: vi.fn(),
    setActive: vi.fn(),
    credentials: vi.fn(),
  },
}))

const summary = (overrides: Partial<AccountSummary> = {}): AccountSummary => ({
  id: 's-1',
  name: 'Carla',
  login: 'carla.dias',
  mustChangePassword: false,
  active: true,
  ...overrides,
})

const detail = (overrides: Partial<AccountDetail> = {}): AccountDetail => ({
  ...summary(),
  role: 'student',
  temporaryPassword: 'Temp1234',
  ...overrides,
})

const slip = (overrides: Partial<CredentialSlip> = {}): CredentialSlip => ({
  userId: 's-1',
  name: 'Carla',
  login: 'carla.dias',
  temporaryPassword: 'Temp1234',
  ...overrides,
})

describe('rosterStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })

  it('load sets classroomId and the student list', async () => {
    vi.mocked(studentRepository.listByClassroom).mockResolvedValue([summary()])

    const store = useRosterStore()
    await store.load('c-1')

    expect(store.classroomId).toBe('c-1')
    expect(store.students).toEqual([summary()])
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('records a load failure as an ApiError', async () => {
    vi.mocked(studentRepository.listByClassroom).mockRejectedValue(new ApiError('api.network_unavailable'))

    const store = useRosterStore()
    await store.load('c-1')

    expect(store.error?.code).toBe('api.network_unavailable')
    expect(store.loading).toBe(false)
  })

  it('createMany calls the repository then reloads the list', async () => {
    vi.mocked(studentRepository.listByClassroom)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([summary({ id: 's-2', name: 'Bia' })])
    vi.mocked(studentRepository.createInClassroom).mockResolvedValue([detail({ id: 's-2', name: 'Bia' })])

    const store = useRosterStore()
    await store.load('c-1')
    const created = await store.createMany([{ id: 's-2', name: 'Bia' }])

    expect(studentRepository.createInClassroom).toHaveBeenCalledWith('c-1', [{ id: 's-2', name: 'Bia' }])
    expect(created).toEqual([detail({ id: 's-2', name: 'Bia' })])
    expect(studentRepository.listByClassroom).toHaveBeenCalledTimes(2)
    expect(store.students).toEqual([summary({ id: 's-2', name: 'Bia' })])
  })

  it('a failed createMany rethrows and does not reload', async () => {
    vi.mocked(studentRepository.listByClassroom).mockResolvedValue([])
    vi.mocked(studentRepository.createInClassroom).mockRejectedValue(new ApiError('api.request_timeout'))

    const store = useRosterStore()
    await store.load('c-1')

    await expect(store.createMany([{ id: 's-2', name: 'Bia' }])).rejects.toBeInstanceOf(ApiError)
    expect(studentRepository.listByClassroom).toHaveBeenCalledTimes(1)
  })

  it('resetPassword returns the detail so the page can show it', async () => {
    vi.mocked(studentRepository.listByClassroom).mockResolvedValue([summary()])
    vi.mocked(studentRepository.resetPassword).mockResolvedValue(detail({ temporaryPassword: 'Temp5678' }))

    const store = useRosterStore()
    await store.load('c-1')
    const result = await store.resetPassword('s-1')

    expect(result.temporaryPassword).toBe('Temp5678')
    expect(studentRepository.listByClassroom).toHaveBeenCalledTimes(2)
  })

  it('moveTo enrols in the target before unenrolling from the current classroom', async () => {
    vi.mocked(studentRepository.listByClassroom).mockResolvedValue([])
    vi.mocked(studentRepository.enrol).mockResolvedValue(undefined)
    vi.mocked(studentRepository.unenrol).mockResolvedValue(undefined)

    const store = useRosterStore()
    await store.load('c-1')
    await store.moveTo('s-1', 'c-2')

    expect(studentRepository.enrol).toHaveBeenCalledWith('c-2', 's-1')
    expect(studentRepository.unenrol).toHaveBeenCalledWith('c-1', 's-1')
    expect(vi.mocked(studentRepository.enrol).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(studentRepository.unenrol).mock.invocationCallOrder[0]!,
    )
  })

  it('a rejected enrol leaves unenrol uncalled', async () => {
    vi.mocked(studentRepository.listByClassroom).mockResolvedValue([])
    vi.mocked(studentRepository.enrol).mockRejectedValue(new ApiError('identity.classroom_not_found'))

    const store = useRosterStore()
    await store.load('c-1')

    await expect(store.moveTo('s-1', 'c-2')).rejects.toBeInstanceOf(ApiError)
    expect(studentRepository.unenrol).not.toHaveBeenCalled()
  })

  it('unenrol calls the repository then reloads', async () => {
    vi.mocked(studentRepository.listByClassroom).mockResolvedValueOnce([summary()]).mockResolvedValueOnce([])
    vi.mocked(studentRepository.unenrol).mockResolvedValue(undefined)

    const store = useRosterStore()
    await store.load('c-1')
    await store.unenrol('s-1')

    expect(studentRepository.unenrol).toHaveBeenCalledWith('c-1', 's-1')
    expect(store.students).toEqual([])
  })

  it('setActive returns the detail and reloads', async () => {
    vi.mocked(studentRepository.listByClassroom).mockResolvedValue([summary({ active: false })])
    vi.mocked(studentRepository.setActive).mockResolvedValue(detail({ active: false }))

    const store = useRosterStore()
    await store.load('c-1')
    const result = await store.setActive('s-1', false)

    expect(studentRepository.setActive).toHaveBeenCalledWith('s-1', false)
    expect(result.active).toBe(false)
    expect(store.students[0]?.active).toBe(false)
  })

  it('loadSlips sets the credential slip list', async () => {
    vi.mocked(studentRepository.credentials).mockResolvedValue([slip()])

    const store = useRosterStore()
    await store.loadSlips('c-1')

    expect(studentRepository.credentials).toHaveBeenCalledWith('c-1')
    expect(store.slips).toEqual([slip()])
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('records a loadSlips failure as an ApiError', async () => {
    vi.mocked(studentRepository.credentials).mockRejectedValue(new ApiError('api.network_unavailable'))

    const store = useRosterStore()
    await store.loadSlips('c-1')

    expect(store.error?.code).toBe('api.network_unavailable')
    expect(store.slips).toEqual([])
    expect(store.loading).toBe(false)
  })

  it('reset clears the cached roster and any error', async () => {
    vi.mocked(studentRepository.listByClassroom).mockRejectedValue(new ApiError('api.network_unavailable'))

    const store = useRosterStore()
    await store.load('c-1')
    expect(store.error).not.toBeNull()

    store.reset()

    expect(store.classroomId).toBeNull()
    expect(store.students).toEqual([])
    expect(store.error).toBeNull()
  })

  it('reset clears the cached credential slips too, since they hold plaintext passwords', async () => {
    vi.mocked(studentRepository.credentials).mockResolvedValue([slip()])

    const store = useRosterStore()
    await store.loadSlips('c-1')
    expect(store.slips).toEqual([slip()])

    store.reset()

    expect(store.slips).toEqual([])
  })
})
