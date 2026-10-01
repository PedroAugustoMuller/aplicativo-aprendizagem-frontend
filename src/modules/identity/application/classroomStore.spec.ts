import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useClassroomStore } from '@/modules/identity/application/classroomStore'
import { classroomRepository } from '@/modules/identity/infrastructure/HttpClassroomRepository'
import { configureOffline } from '@/shared/offline/readThrough'
import { createMemoryStorage } from '@/shared/offline/storage'
import { ApiError } from '@/shared/api/error'

vi.mock('@/modules/identity/infrastructure/HttpClassroomRepository', () => ({
  classroomRepository: {
    list: vi.fn(), subjectOptions: vi.fn(), create: vi.fn(), update: vi.fn(), assignTeachers: vi.fn(), deactivate: vi.fn(),
  },
}))

const QUIMICA_1 = { id: 'c-1', name: 'Química 1', subjectId: 's-1', teacherIds: ['t-1'], studentCount: 2, active: true }
const QUIMICA = { id: 's-1', name: 'Química', active: true }

describe('classroomStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    configureOffline({ userId: () => 'u-1', storage: createMemoryStorage() })
    vi.mocked(classroomRepository.list).mockResolvedValue([QUIMICA_1])
    vi.mocked(classroomRepository.subjectOptions).mockResolvedValue([QUIMICA])
  })

  it('loads classes and the subjects that label them', async () => {
    const store = useClassroomStore()
    await store.load()

    expect(store.classrooms).toEqual([QUIMICA_1])
    expect(store.find('c-1')).toEqual(QUIMICA_1)
    expect(store.subjectName('s-1')).toBe('Química')
    expect(store.subjectName('missing')).toBeNull()
  })

  it('shows saved data offline, dated by the older of the two copies', async () => {
    const store = useClassroomStore()
    await store.load()
    vi.mocked(classroomRepository.list).mockRejectedValue(new ApiError('api.network_unavailable'))
    vi.mocked(classroomRepository.subjectOptions).mockRejectedValue(new ApiError('api.network_unavailable'))

    await store.load()

    expect(store.classrooms).toEqual([QUIMICA_1])
    expect(store.savedAt).toBeInstanceOf(Date)
  })

  it('records a failure', async () => {
    vi.mocked(classroomRepository.list).mockRejectedValue(new ApiError('auth.forbidden', {}, 403))

    const store = useClassroomStore()
    await store.load()

    expect(store.error?.code).toBe('auth.forbidden')
  })

  it('ensureLoaded loads only once', async () => {
    const store = useClassroomStore()
    await store.ensureLoaded()
    await store.ensureLoaded()

    expect(classroomRepository.list).toHaveBeenCalledTimes(1)
  })

  it('reloads after each change', async () => {
    const store = useClassroomStore()
    await store.create('c-2', { name: 'Química 2', subjectId: 's-1' })
    await store.update('c-2', { name: 'Química B', subjectId: 's-1' })
    await store.assignTeachers('c-2', ['t-1'])
    await store.deactivate('c-2')

    expect(classroomRepository.create).toHaveBeenCalledWith('c-2', { name: 'Química 2', subjectId: 's-1' })
    expect(classroomRepository.list).toHaveBeenCalledTimes(4)
  })

  it('reset forgets everything', async () => {
    const store = useClassroomStore()
    await store.load()
    store.reset()

    expect(store.classrooms).toEqual([])
    expect(store.subjects).toEqual([])
    expect(store.savedAt).toBeNull()
  })
})
