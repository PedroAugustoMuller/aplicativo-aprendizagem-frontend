import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTopicStore } from '@/modules/content/application/topicStore'
import { topicRepository } from '@/modules/content/infrastructure/HttpTopicRepository'
import { ApiError } from '@/shared/api/error'

vi.mock('@/modules/content/infrastructure/HttpTopicRepository', () => ({
  topicRepository: { list: vi.fn() },
}))

describe('topicStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })

  it('loads topics and clears the loading flag', async () => {
    vi.mocked(topicRepository.list).mockResolvedValue([
      { id: 't-1', name: 'Átomos', description: 'x', position: 1 },
    ])

    const store = useTopicStore()
    await store.load()

    expect(store.topics).toHaveLength(1)
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('records the error as an ApiError instead of a message', async () => {
    vi.mocked(topicRepository.list).mockRejectedValue(new ApiError('api.network_unavailable'))

    const store = useTopicStore()
    await store.load()

    expect(store.error?.code).toBe('api.network_unavailable')
    expect(store.topics).toEqual([])
    expect(store.loading).toBe(false)
  })

  it('clears a previous error on a successful retry', async () => {
    const store = useTopicStore()

    vi.mocked(topicRepository.list).mockRejectedValueOnce(new ApiError('api.network_unavailable'))
    await store.load()
    expect(store.error).not.toBeNull()

    vi.mocked(topicRepository.list).mockResolvedValue([
      { id: 't-1', name: 'Átomos', description: 'x', position: 1 },
    ])
    await store.load()

    expect(store.error).toBeNull()
    expect(store.topics).toHaveLength(1)
  })

  it('resets topics to empty on a failure after a successful load', async () => {
    const store = useTopicStore()

    vi.mocked(topicRepository.list).mockResolvedValueOnce([
      { id: 't-1', name: 'Átomos', description: 'x', position: 1 },
    ])
    await store.load()
    expect(store.topics).toHaveLength(1)

    vi.mocked(topicRepository.list).mockRejectedValueOnce(new ApiError('api.network_unavailable'))
    await store.load()

    expect(store.topics).toEqual([])
    expect(store.error?.code).toBe('api.network_unavailable')
  })
})
