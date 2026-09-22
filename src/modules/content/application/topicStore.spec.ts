import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTopicStore } from '@/modules/content/application/topicStore'
import { topicRepository } from '@/modules/content/infrastructure/HttpTopicRepository'
import { ApiError } from '@/shared/api/error'

vi.mock('@/modules/content/infrastructure/HttpTopicRepository', () => ({
  topicRepository: { listBySubject: vi.fn() },
}))

describe('topicStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })

  it('loads topics for the given subject and clears the loading flag', async () => {
    vi.mocked(topicRepository.listBySubject).mockResolvedValue([
      { id: 't-1', name: 'Átomos', description: 'x', position: 1 },
    ])

    const store = useTopicStore()
    await store.load('s-1')

    expect(topicRepository.listBySubject).toHaveBeenCalledWith('s-1')
    expect(store.topics).toHaveLength(1)
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('records the error as an ApiError instead of a message', async () => {
    vi.mocked(topicRepository.listBySubject).mockRejectedValue(new ApiError('api.network_unavailable'))

    const store = useTopicStore()
    await store.load('s-1')

    expect(store.error?.code).toBe('api.network_unavailable')
    expect(store.topics).toEqual([])
    expect(store.loading).toBe(false)
  })

  it('clears a previous error on a successful retry', async () => {
    const store = useTopicStore()

    vi.mocked(topicRepository.listBySubject).mockRejectedValueOnce(new ApiError('api.network_unavailable'))
    await store.load('s-1')
    expect(store.error).not.toBeNull()

    vi.mocked(topicRepository.listBySubject).mockResolvedValue([
      { id: 't-1', name: 'Átomos', description: 'x', position: 1 },
    ])
    await store.load('s-1')

    expect(store.error).toBeNull()
    expect(store.topics).toHaveLength(1)
  })

  it('resets topics to empty on a failure after a successful load', async () => {
    const store = useTopicStore()

    vi.mocked(topicRepository.listBySubject).mockResolvedValueOnce([
      { id: 't-1', name: 'Átomos', description: 'x', position: 1 },
    ])
    await store.load('s-1')
    expect(store.topics).toHaveLength(1)

    vi.mocked(topicRepository.listBySubject).mockRejectedValueOnce(new ApiError('api.network_unavailable'))
    await store.load('s-1')

    expect(store.topics).toEqual([])
    expect(store.error?.code).toBe('api.network_unavailable')
  })

  it('reset() clears topics, loading and error', async () => {
    const store = useTopicStore()
    vi.mocked(topicRepository.listBySubject).mockRejectedValueOnce(new ApiError('api.network_unavailable'))
    await store.load('s-1')
    expect(store.error).not.toBeNull()

    store.reset()

    expect(store.topics).toEqual([])
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })
})
