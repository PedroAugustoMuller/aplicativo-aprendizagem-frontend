import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSubjectStore } from '@/modules/content/application/subjectStore'
import { subjectRepository } from '@/modules/content/infrastructure/HttpSubjectRepository'
import { ApiError } from '@/shared/api/error'
import { configureOffline } from '@/shared/offline/readThrough'
import { createMemoryStorage } from '@/shared/offline/storage'

vi.mock('@/modules/content/infrastructure/HttpSubjectRepository', () => ({
  subjectRepository: { list: vi.fn() },
}))

const QUIMICA = { id: 's-1', name: 'Química', active: true }

describe('subjectStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    configureOffline({ userId: () => 'u-1', storage: createMemoryStorage() })
  })

  it('loads subjects and clears the loading flag', async () => {
    vi.mocked(subjectRepository.list).mockResolvedValue([QUIMICA])

    const store = useSubjectStore()
    await store.load()

    expect(store.subjects).toEqual([QUIMICA])
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('records the error as an ApiError and empties the list', async () => {
    vi.mocked(subjectRepository.list).mockRejectedValue(new ApiError('api.network_unavailable'))

    const store = useSubjectStore()
    await store.load()

    expect(store.error?.code).toBe('api.network_unavailable')
    expect(store.subjects).toEqual([])
    expect(store.loading).toBe(false)
  })

  it('wraps a non-ApiError failure as an unexpected error', async () => {
    vi.mocked(subjectRepository.list).mockRejectedValue(new TypeError('boom'))

    const store = useSubjectStore()
    await store.load()

    expect(store.error?.code).toBe('system.unexpected_error')
  })

  it('ensureLoaded fetches once, then reuses what it has', async () => {
    vi.mocked(subjectRepository.list).mockResolvedValue([QUIMICA])

    const store = useSubjectStore()
    await store.ensureLoaded()
    await store.ensureLoaded()

    expect(subjectRepository.list).toHaveBeenCalledTimes(1)
  })

  it('ensureLoaded tries again after a failed load', async () => {
    vi.mocked(subjectRepository.list).mockRejectedValueOnce(new ApiError('api.network_unavailable'))
    vi.mocked(subjectRepository.list).mockResolvedValueOnce([QUIMICA])

    const store = useSubjectStore()
    await store.ensureLoaded()
    await store.ensureLoaded()

    expect(subjectRepository.list).toHaveBeenCalledTimes(2)
    expect(store.subjects).toEqual([QUIMICA])
  })

  it('coalesces concurrent loads into one request', async () => {
    vi.mocked(subjectRepository.list).mockResolvedValue([QUIMICA])

    const store = useSubjectStore()
    await Promise.all([store.load(), store.ensureLoaded()])

    expect(subjectRepository.list).toHaveBeenCalledTimes(1)
  })

  it('looks a subject name up by id', async () => {
    vi.mocked(subjectRepository.list).mockResolvedValue([QUIMICA])

    const store = useSubjectStore()
    await store.load()

    expect(store.nameOf('s-1')).toBe('Química')
    expect(store.nameOf('missing')).toBeNull()
  })

  it('ensureLoaded tries again after a reload fails', async () => {
    vi.mocked(subjectRepository.list).mockResolvedValueOnce([QUIMICA])
    vi.mocked(subjectRepository.list).mockRejectedValueOnce(new ApiError('api.network_unavailable'))
    vi.mocked(subjectRepository.list).mockResolvedValueOnce([QUIMICA])

    const store = useSubjectStore()
    await store.load()
    await store.load()
    await store.ensureLoaded()

    expect(subjectRepository.list).toHaveBeenCalledTimes(3)
    expect(store.nameOf('s-1')).toBe('Química')
  })

  it('reset forgets everything, so the next visit fetches again', async () => {
    vi.mocked(subjectRepository.list).mockResolvedValue([QUIMICA])

    const store = useSubjectStore()
    await store.load()
    store.reset()

    expect(store.subjects).toEqual([])
    expect(store.error).toBeNull()
    await store.ensureLoaded()
    expect(subjectRepository.list).toHaveBeenCalledTimes(2)
  })

  it('reset drops a subjects response still in flight', async () => {
    let finish: (subjects: typeof QUIMICA[]) => void = () => undefined
    vi.mocked(subjectRepository.list).mockReturnValueOnce(new Promise((resolve) => {
      finish = resolve
    }))

    const store = useSubjectStore()
    const loading = store.load()
    store.reset()
    finish([QUIMICA])
    await loading

    expect(store.subjects).toEqual([])
    expect(store.loading).toBe(false)
  })

  it('a load from before reset cannot overwrite the load that followed it', async () => {
    let finishOld: (subjects: typeof QUIMICA[]) => void = () => undefined
    let finishNew: (subjects: typeof QUIMICA[]) => void = () => undefined
    const BIOLOGIA = { id: 's-2', name: 'Biologia', active: true }
    vi.mocked(subjectRepository.list)
      .mockReturnValueOnce(new Promise((resolve) => {
        finishOld = resolve
      }))
      .mockReturnValueOnce(new Promise((resolve) => {
        finishNew = resolve
      }))

    const store = useSubjectStore()
    const old = store.load()
    store.reset()
    const next = store.load()

    finishOld([QUIMICA])
    await old
    expect(store.loading).toBe(true)

    finishNew([BIOLOGIA])
    await next
    expect(store.subjects).toEqual([BIOLOGIA])
    expect(store.loading).toBe(false)
  })

  it('shows the saved list, and when it was saved, while offline', async () => {
    vi.mocked(subjectRepository.list).mockResolvedValueOnce([QUIMICA])
    vi.mocked(subjectRepository.list).mockRejectedValueOnce(new ApiError('api.network_unavailable'))

    const store = useSubjectStore()
    await store.load()
    expect(store.savedAt).toBeNull()

    await store.load()

    expect(store.subjects).toEqual([QUIMICA])
    expect(store.savedAt).toBeInstanceOf(Date)
    expect(store.error).toBeNull()
  })
})
