import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useQuestionStore } from '@/modules/content/application/questionStore'
import { questionRepository } from '@/modules/content/infrastructure/HttpQuestionRepository'
import { ApiError } from '@/shared/api/error'
import { configureOffline } from '@/shared/offline/readThrough'
import { createMemoryStorage } from '@/shared/offline/storage'
import type { Question, QuestionContent } from '@/modules/content/domain/Question'

vi.mock('@/modules/content/infrastructure/HttpQuestionRepository', () => ({
  questionRepository: { listByTopic: vi.fn(), create: vi.fn(), update: vi.fn(), deactivate: vi.fn(), reactivate: vi.fn() },
}))

const SODIUM: Question = {
  id: 'q-1',
  topicId: 't-1',
  type: 'true_false',
  statement: 'O sódio é um metal.',
  explanation: null,
  active: true,
  version: 1,
  options: [{ id: 'v', text: 'Verdadeiro', correct: true }, { id: 'f', text: 'Falso', correct: false }],
}
const CONTENT: QuestionContent = { type: 'true_false', statement: 'x', explanation: null, answer: true }

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })

  return { promise, resolve }
}

describe('questionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    configureOffline({ userId: () => 'u-1', storage: createMemoryStorage() })
  })

  it('loads a topic\'s bank and finds a question in it', async () => {
    vi.mocked(questionRepository.listByTopic).mockResolvedValue([SODIUM])
    const store = useQuestionStore()

    await store.load('t-1')

    expect(store.topicId).toBe('t-1')
    expect(store.questions).toEqual([SODIUM])
    expect(store.find('q-1')).toEqual(SODIUM)
    expect(store.find('nope')).toBeNull()
  })

  it('serves the saved bank of that topic while offline', async () => {
    vi.mocked(questionRepository.listByTopic).mockResolvedValueOnce([SODIUM])
    vi.mocked(questionRepository.listByTopic).mockRejectedValueOnce(new ApiError('api.network_unavailable'))
    const store = useQuestionStore()

    await store.load('t-1')
    store.reset()
    await store.load('t-1')

    expect(store.questions).toEqual([SODIUM])
    expect(store.savedAt).toBeInstanceOf(Date)
  })

  it('discards a slow response for a topic the user already left', async () => {
    const slow = deferred<Question[]>()
    vi.mocked(questionRepository.listByTopic).mockReturnValueOnce(slow.promise)
    vi.mocked(questionRepository.listByTopic).mockResolvedValueOnce([])
    const store = useQuestionStore()

    const first = store.load('t-1')
    await store.load('t-2')
    slow.resolve([SODIUM])
    await first

    expect(store.topicId).toBe('t-2')
    expect(store.questions).toEqual([])
  })

  it('creates and updates in the current topic, then reloads', async () => {
    vi.mocked(questionRepository.listByTopic).mockResolvedValue([SODIUM])
    vi.mocked(questionRepository.create).mockResolvedValue(SODIUM)
    vi.mocked(questionRepository.update).mockResolvedValue(SODIUM)
    const store = useQuestionStore()
    await store.load('t-1')

    await store.create('q-2', CONTENT)
    await store.update('q-1', 1, CONTENT)

    expect(questionRepository.create).toHaveBeenCalledWith('t-1', 'q-2', CONTENT)
    expect(questionRepository.update).toHaveBeenCalledWith('q-1', 1, CONTENT)
    expect(questionRepository.listByTopic).toHaveBeenCalledTimes(3)
  })

  it('lets a write\'s ApiError reach the caller', async () => {
    vi.mocked(questionRepository.listByTopic).mockResolvedValue([SODIUM])
    vi.mocked(questionRepository.update).mockRejectedValue(new ApiError('content.question.edited_elsewhere', {}, 409))
    const store = useQuestionStore()
    await store.load('t-1')

    await expect(store.update('q-1', 1, CONTENT)).rejects.toMatchObject({ code: 'content.question.edited_elsewhere' })
  })

  it('deactivates or reactivates through the matching call', async () => {
    vi.mocked(questionRepository.listByTopic).mockResolvedValue([SODIUM])
    vi.mocked(questionRepository.deactivate).mockResolvedValue(SODIUM)
    vi.mocked(questionRepository.reactivate).mockResolvedValue(SODIUM)
    const store = useQuestionStore()
    await store.load('t-1')

    await store.setActive('q-1', false)
    await store.setActive('q-1', true)

    expect(questionRepository.deactivate).toHaveBeenCalledWith('q-1')
    expect(questionRepository.reactivate).toHaveBeenCalledWith('q-1')
  })
})
