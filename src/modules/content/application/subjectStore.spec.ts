import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSubjectStore } from '@/modules/content/application/subjectStore'
import { subjectRepository } from '@/modules/content/infrastructure/HttpSubjectRepository'
import { ApiError } from '@/shared/api/error'

vi.mock('@/modules/content/infrastructure/HttpSubjectRepository', () => ({
  subjectRepository: { list: vi.fn() },
}))

const QUIMICA = { id: 's-1', name: 'Química', active: true }

describe('subjectStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
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
})
