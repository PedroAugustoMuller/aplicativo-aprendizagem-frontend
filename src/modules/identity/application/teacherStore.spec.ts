import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTeacherStore } from '@/modules/identity/application/teacherStore'
import { teacherRepository } from '@/modules/identity/infrastructure/HttpTeacherRepository'
import { configureOffline } from '@/shared/offline/readThrough'
import { createMemoryStorage } from '@/shared/offline/storage'
import { ApiError } from '@/shared/api/error'

vi.mock('@/modules/identity/infrastructure/HttpTeacherRepository', () => ({
  teacherRepository: { list: vi.fn(), create: vi.fn(), resetPassword: vi.fn(), setActive: vi.fn() },
}))

const BRUNO = { id: 't-1', name: 'Bruno', email: 'bruno@escola.br', mustChangePassword: false, active: true }
const ISSUED = { id: 't-1', name: 'Bruno', login: 'bruno@escola.br', temporaryPassword: 'Abc23456' }

describe('teacherStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    configureOffline({ userId: () => 'u-1', storage: createMemoryStorage() })
  })

  it('loads the teachers', async () => {
    vi.mocked(teacherRepository.list).mockResolvedValue([BRUNO])

    const store = useTeacherStore()
    await store.load()

    expect(store.teachers).toEqual([BRUNO])
    expect(store.loading).toBe(false)
    expect(store.savedAt).toBeNull()
  })

  it('shows the saved list while offline', async () => {
    vi.mocked(teacherRepository.list).mockResolvedValueOnce([BRUNO])
    vi.mocked(teacherRepository.list).mockRejectedValueOnce(new ApiError('api.network_unavailable'))

    const store = useTeacherStore()
    await store.load()
    await store.load()

    expect(store.teachers).toEqual([BRUNO])
    expect(store.savedAt).toBeInstanceOf(Date)
  })

  it('records a failure as an ApiError', async () => {
    vi.mocked(teacherRepository.list).mockRejectedValue(new ApiError('auth.forbidden', {}, 403))

    const store = useTeacherStore()
    await store.load()

    expect(store.error?.code).toBe('auth.forbidden')
    expect(store.teachers).toEqual([])
  })

  it('creates, returns the temporary password and reloads', async () => {
    vi.mocked(teacherRepository.create).mockResolvedValue(ISSUED)
    vi.mocked(teacherRepository.list).mockResolvedValue([BRUNO])

    const store = useTeacherStore()
    await expect(store.create({ id: 't-1', name: 'Bruno', email: 'bruno@escola.br' })).resolves.toEqual(ISSUED)

    expect(store.teachers).toEqual([BRUNO])
  })

  it('resets a password and changes status, reloading each time', async () => {
    vi.mocked(teacherRepository.resetPassword).mockResolvedValue(ISSUED)
    vi.mocked(teacherRepository.setActive).mockResolvedValue()
    vi.mocked(teacherRepository.list).mockResolvedValue([BRUNO])

    const store = useTeacherStore()
    await expect(store.resetPassword('t-1')).resolves.toEqual(ISSUED)
    await store.setActive('t-1', false)

    expect(teacherRepository.setActive).toHaveBeenCalledWith('t-1', false)
    expect(teacherRepository.list).toHaveBeenCalledTimes(2)
  })

  it('reset forgets everything', async () => {
    vi.mocked(teacherRepository.list).mockResolvedValue([BRUNO])

    const store = useTeacherStore()
    await store.load()
    store.reset()

    expect(store.teachers).toEqual([])
    expect(store.savedAt).toBeNull()
  })
})
