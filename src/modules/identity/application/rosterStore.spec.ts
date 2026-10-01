import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useRosterStore } from '@/modules/identity/application/rosterStore'
import { studentRepository } from '@/modules/identity/infrastructure/HttpStudentRepository'
import { configureOffline } from '@/shared/offline/readThrough'
import { createMemoryStorage } from '@/shared/offline/storage'
import { ApiError } from '@/shared/api/error'

vi.mock('@/modules/identity/infrastructure/HttpStudentRepository', () => ({
  studentRepository: {
    listByClassroom: vi.fn(), createMany: vi.fn(), unenrol: vi.fn(), resetPassword: vi.fn(), setActive: vi.fn(), credentials: vi.fn(),
  },
}))

const ANA = { id: 's-1', name: 'Ana', username: 'ana.lima', mustChangePassword: true, active: true }

describe('rosterStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    configureOffline({ userId: () => 'u-1', storage: createMemoryStorage() })
    vi.mocked(studentRepository.listByClassroom).mockResolvedValue([ANA])
  })

  it('loads a class roster', async () => {
    const store = useRosterStore()
    await store.load('c-1')

    expect(store.classroomId).toBe('c-1')
    expect(store.students).toEqual([ANA])
  })

  it('shows the saved roster offline', async () => {
    const store = useRosterStore()
    await store.load('c-1')
    vi.mocked(studentRepository.listByClassroom).mockRejectedValue(new ApiError('api.network_unavailable'))

    await store.load('c-1')

    expect(store.students).toEqual([ANA])
    expect(store.savedAt).toBeInstanceOf(Date)
  })

  it('never shows another class\'s roster while switching', async () => {
    const store = useRosterStore()
    await store.load('c-1')
    vi.mocked(studentRepository.listByClassroom).mockReturnValue(new Promise(() => undefined))

    void store.load('c-2')

    expect(store.students).toEqual([])
  })

  it('creates a batch, returns the passwords and reloads', async () => {
    vi.mocked(studentRepository.createMany).mockResolvedValue([
      { id: 's-2', name: 'Bia', login: 'bia', temporaryPassword: 'x' },
    ])

    const store = useRosterStore()
    const issued = await store.createMany('c-1', [{ id: 's-2', name: 'Bia' }])

    expect(issued).toHaveLength(1)
    expect(studentRepository.listByClassroom).toHaveBeenCalledWith('c-1')
  })

  it('reloads after unenrol, reset and status changes', async () => {
    vi.mocked(studentRepository.resetPassword).mockResolvedValue({ id: 's-1', name: 'Ana', login: 'ana.lima', temporaryPassword: 'y' })

    const store = useRosterStore()
    await store.unenrol('c-1', 's-1')
    await store.resetPassword('c-1', 's-1')
    await store.setActive('c-1', 's-1', false)

    expect(studentRepository.unenrol).toHaveBeenCalledWith('c-1', 's-1')
    expect(studentRepository.setActive).toHaveBeenCalledWith('s-1', false)
    expect(studentRepository.listByClassroom).toHaveBeenCalledTimes(3)
  })

  it('loads access slips without keeping an offline copy', async () => {
    vi.mocked(studentRepository.credentials).mockResolvedValueOnce([
      { userId: 's-1', name: 'Ana', username: 'ana.lima', temporaryPassword: 'Abc23456' },
    ])
    vi.mocked(studentRepository.credentials).mockRejectedValueOnce(new ApiError('api.network_unavailable'))

    const store = useRosterStore()
    await store.loadCredentials('c-1')
    expect(store.credentials).toHaveLength(1)

    await store.loadCredentials('c-1')

    expect(store.credentials).toEqual([])
    expect(store.credentialsError?.code).toBe('api.network_unavailable')
  })

  it('reset forgets everything', async () => {
    const store = useRosterStore()
    await store.load('c-1')
    store.reset()

    expect(store.classroomId).toBeNull()
    expect(store.students).toEqual([])
    expect(store.credentials).toEqual([])
  })
})
