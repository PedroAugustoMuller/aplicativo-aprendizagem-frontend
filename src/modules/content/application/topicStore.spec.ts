import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTopicStore } from '@/modules/content/application/topicStore'
import { topicRepository } from '@/modules/content/infrastructure/HttpTopicRepository'
import { ApiError } from '@/shared/api/error'
import { configureOffline } from '@/shared/offline/readThrough'
import { createMemoryStorage } from '@/shared/offline/storage'
import type { Topic } from '@/modules/content/domain/Topic'

vi.mock('@/modules/content/infrastructure/HttpTopicRepository', () => ({
  topicRepository: { listBySubject: vi.fn(), create: vi.fn(), update: vi.fn(), deactivate: vi.fn(), reactivate: vi.fn(), reorder: vi.fn() },
}))

const ATOMS = { id: 't-1', name: 'Átomos', description: 'x', position: 1, active: true, questionCount: null }
const CELLS = { id: 't-9', name: 'Células', description: 'y', position: 1, active: true, questionCount: null }

/** A promise the test resolves by hand, to reorder responses. */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })

  return { promise, resolve }
}

describe('topicStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    configureOffline({ userId: () => 'u-1', storage: createMemoryStorage() })
  })

  it('loads the topics of a subject and clears the loading flag', async () => {
    vi.mocked(topicRepository.listBySubject).mockResolvedValue([ATOMS])

    const store = useTopicStore()
    await store.load('s-1')

    expect(topicRepository.listBySubject).toHaveBeenCalledWith('s-1')
    expect(store.subjectId).toBe('s-1')
    expect(store.topics).toEqual([ATOMS])
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

    vi.mocked(topicRepository.listBySubject).mockResolvedValue([ATOMS])
    await store.load('s-1')

    expect(store.error).toBeNull()
    expect(store.topics).toEqual([ATOMS])
  })

  it('never shows one subject\'s topics while another subject is loading', async () => {
    const store = useTopicStore()
    vi.mocked(topicRepository.listBySubject).mockResolvedValueOnce([ATOMS])
    await store.load('s-1')

    const pending = deferred<Topic[]>()
    vi.mocked(topicRepository.listBySubject).mockReturnValueOnce(pending.promise)
    const loading = store.load('s-2')

    expect(store.topics).toEqual([])
    expect(store.subjectId).toBe('s-2')

    pending.resolve([CELLS])
    await loading
    expect(store.topics).toEqual([CELLS])
  })

  it('discards a slow response for a subject the user already left', async () => {
    const store = useTopicStore()
    const slow = deferred<Topic[]>()
    vi.mocked(topicRepository.listBySubject).mockReturnValueOnce(slow.promise)
    vi.mocked(topicRepository.listBySubject).mockResolvedValueOnce([CELLS])

    const first = store.load('s-1')
    await store.load('s-2')
    slow.resolve([ATOMS])
    await first

    expect(store.subjectId).toBe('s-2')
    expect(store.topics).toEqual([CELLS])
    expect(store.loading).toBe(false)
  })

  it('reset forgets the subject and drops a response still in flight', async () => {
    const store = useTopicStore()
    const slow = deferred<Topic[]>()
    vi.mocked(topicRepository.listBySubject).mockReturnValueOnce(slow.promise)

    const loading = store.load('s-1')
    store.reset()
    slow.resolve([ATOMS])
    await loading

    expect(store.subjectId).toBeNull()
    expect(store.topics).toEqual([])
    expect(store.loading).toBe(false)
  })

  it('shows the saved topics of that subject while offline', async () => {
    vi.mocked(topicRepository.listBySubject).mockResolvedValueOnce([ATOMS])
    vi.mocked(topicRepository.listBySubject).mockRejectedValueOnce(new ApiError('api.network_unavailable'))

    const store = useTopicStore()
    await store.load('s-1')
    store.reset()
    await store.load('s-1')

    expect(store.topics).toEqual([ATOMS])
    expect(store.savedAt).toBeInstanceOf(Date)
  })

  it('does not serve one subject\'s saved topics for another', async () => {
    vi.mocked(topicRepository.listBySubject).mockResolvedValueOnce([ATOMS])
    vi.mocked(topicRepository.listBySubject).mockRejectedValueOnce(new ApiError('api.network_unavailable'))

    const store = useTopicStore()
    await store.load('s-1')
    await store.load('s-2')

    expect(store.topics).toEqual([])
    expect(store.error?.code).toBe('api.network_unavailable')
  })

  it('creates a topic in the current subject and reloads', async () => {
    vi.mocked(topicRepository.listBySubject).mockResolvedValue([ATOMS])
    vi.mocked(topicRepository.create).mockResolvedValue(ATOMS)
    const store = useTopicStore()
    await store.load('s-1')

    await store.create('t-1', { name: 'Átomos', description: '' })

    expect(topicRepository.create).toHaveBeenCalledWith('s-1', 't-1', { name: 'Átomos', description: '' })
    expect(topicRepository.listBySubject).toHaveBeenCalledTimes(2)
  })

  it('moves a topic up by sending the whole order', async () => {
    const second = { ...CELLS, position: 2 }
    vi.mocked(topicRepository.listBySubject).mockResolvedValue([ATOMS, second])
    vi.mocked(topicRepository.reorder).mockResolvedValue([second, ATOMS])
    const store = useTopicStore()
    await store.load('s-1')

    await store.move('t-9', -1)

    expect(topicRepository.reorder).toHaveBeenCalledWith('s-1', ['t-9', 't-1'])
  })

  it('does nothing when moving past either end', async () => {
    vi.mocked(topicRepository.listBySubject).mockResolvedValue([ATOMS])
    const store = useTopicStore()
    await store.load('s-1')

    await store.move('t-1', -1)
    await store.move('t-1', 1)

    expect(topicRepository.reorder).not.toHaveBeenCalled()
  })

  it('reloads and still reports a stale order', async () => {
    vi.mocked(topicRepository.listBySubject).mockResolvedValue([ATOMS, { ...CELLS, position: 2 }])
    vi.mocked(topicRepository.reorder).mockRejectedValue(new ApiError('content.topic.order_stale', {}, 409))
    const store = useTopicStore()
    await store.load('s-1')

    await expect(store.move('t-9', -1)).rejects.toMatchObject({ code: 'content.topic.order_stale' })
    expect(topicRepository.listBySubject).toHaveBeenCalledTimes(2)
  })

  it('deactivates or reactivates through the matching call', async () => {
    vi.mocked(topicRepository.listBySubject).mockResolvedValue([ATOMS])
    vi.mocked(topicRepository.deactivate).mockResolvedValue(ATOMS)
    vi.mocked(topicRepository.reactivate).mockResolvedValue(ATOMS)
    const store = useTopicStore()
    await store.load('s-1')

    await store.setActive('t-1', false)
    await store.setActive('t-1', true)

    expect(topicRepository.deactivate).toHaveBeenCalledWith('t-1')
    expect(topicRepository.reactivate).toHaveBeenCalledWith('t-1')
  })
})
