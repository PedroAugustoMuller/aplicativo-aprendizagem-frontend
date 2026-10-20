import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useQuestionSuggestionStore, asPreview } from '@/modules/content/application/questionSuggestionStore'
import { useQuestionStore } from '@/modules/content/application/questionStore'
import { questionSuggestionRepository } from '@/modules/content/infrastructure/HttpQuestionSuggestionRepository'
import { questionRepository } from '@/modules/content/infrastructure/HttpQuestionRepository'
import { ApiError } from '@/shared/api/error'
import { configureOffline } from '@/shared/offline/readThrough'
import { createMemoryStorage } from '@/shared/offline/storage'
import { blankRequest } from '@/modules/content/domain/QuestionSuggestion'
import type { QuestionContent } from '@/modules/content/domain/Question'

vi.mock('@/modules/content/infrastructure/HttpQuestionSuggestionRepository', () => ({
  questionSuggestionRepository: { suggest: vi.fn() },
}))
vi.mock('@/modules/content/infrastructure/HttpQuestionRepository', () => ({
  questionRepository: { listByTopic: vi.fn(), create: vi.fn(), update: vi.fn(), deactivate: vi.fn(), reactivate: vi.fn() },
}))

const TF: QuestionContent = { type: 'true_false', statement: 'O sódio é um metal.', explanation: null, answer: true }
const MC: QuestionContent = {
  type: 'multiple_choice', statement: 'Símbolo do sódio?', explanation: 'Natrium.',
  options: [{ id: null, text: 'Na', correct: true }, { id: null, text: 'S', correct: false }],
}

describe('questionSuggestionStore', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    configureOffline({ userId: () => 'u-1', storage: createMemoryStorage() })
    vi.mocked(questionRepository.listByTopic).mockResolvedValue([])
    await useQuestionStore().load('t-1')
  })

  it('appends each generation with a fresh key per suggestion', async () => {
    vi.mocked(questionSuggestionRepository.suggest).mockResolvedValueOnce([TF]).mockResolvedValueOnce([MC])
    const store = useQuestionSuggestionStore()

    await store.generate('t-1', blankRequest())
    await store.generate('t-1', blankRequest())

    const list = store.list('t-1')
    expect(list.map((s) => s.content)).toEqual([TF, MC])
    expect(new Set(list.map((s) => s.key)).size).toBe(2)
  })

  it('keeps each topic apart', async () => {
    vi.mocked(questionSuggestionRepository.suggest).mockResolvedValue([TF])
    const store = useQuestionSuggestionStore()

    await store.generate('t-1', blankRequest())

    expect(store.list('t-2')).toEqual([])
  })

  it('lets a failed generation reach the caller and keeps what was there', async () => {
    vi.mocked(questionSuggestionRepository.suggest).mockResolvedValueOnce([TF]).mockRejectedValueOnce(new ApiError('content.suggestions.unavailable'))
    const store = useQuestionSuggestionStore()
    await store.generate('t-1', blankRequest())

    await expect(store.generate('t-1', blankRequest())).rejects.toMatchObject({ code: 'content.suggestions.unavailable' })
    expect(store.list('t-1')).toHaveLength(1)
  })

  it('accepting saves through the bank with the suggestion key as the question id, then drops it', async () => {
    vi.mocked(questionSuggestionRepository.suggest).mockResolvedValue([TF, MC])
    const store = useQuestionSuggestionStore()
    await store.generate('t-1', blankRequest())
    const [first] = store.list('t-1')

    await store.accept('t-1', first!.key)

    expect(questionRepository.create).toHaveBeenCalledWith('t-1', first!.key, TF)
    expect(store.list('t-1').map((s) => s.content)).toEqual([MC])
  })

  it('a retried accept after a failure reuses the same id', async () => {
    vi.mocked(questionSuggestionRepository.suggest).mockResolvedValue([TF])
    vi.mocked(questionRepository.create).mockRejectedValueOnce(new ApiError('api.request_timeout'))
    const store = useQuestionSuggestionStore()
    await store.generate('t-1', blankRequest())
    const key = store.list('t-1')[0]!.key

    await expect(store.accept('t-1', key)).rejects.toBeInstanceOf(ApiError)
    expect(store.list('t-1')).toHaveLength(1)
    await store.accept('t-1', key)

    expect(vi.mocked(questionRepository.create).mock.calls.map((call) => call[1])).toEqual([key, key])
  })

  it('accept all stops at the first failure and keeps the rest', async () => {
    vi.mocked(questionSuggestionRepository.suggest).mockResolvedValue([TF, MC, TF])
    vi.mocked(questionRepository.create).mockResolvedValueOnce({} as never).mockRejectedValueOnce(new ApiError('api.network_unavailable'))
    const store = useQuestionSuggestionStore()
    await store.generate('t-1', blankRequest())

    await expect(store.acceptAll('t-1')).rejects.toBeInstanceOf(ApiError)

    expect(store.list('t-1')).toHaveLength(2)
  })

  it('discards one suggestion', async () => {
    vi.mocked(questionSuggestionRepository.suggest).mockResolvedValue([TF, MC])
    const store = useQuestionSuggestionStore()
    await store.generate('t-1', blankRequest())

    store.discard('t-1', store.list('t-1')[0]!.key)

    expect(store.list('t-1').map((s) => s.content)).toEqual([MC])
  })

  it('remembers the request form per topic', () => {
    const store = useQuestionSuggestionStore()
    store.saveDraft('t-1', { ...blankRequest(), notes: 'Sem cálculos' })

    expect(store.draft('t-1').notes).toBe('Sem cálculos')
    expect(store.draft('t-2')).toEqual(blankRequest())
  })

  it('reset forgets everything', async () => {
    vi.mocked(questionSuggestionRepository.suggest).mockResolvedValue([TF])
    const store = useQuestionSuggestionStore()
    await store.generate('t-1', blankRequest())
    store.saveDraft('t-1', { ...blankRequest(), notes: 'x' })

    store.reset()

    expect(store.list('t-1')).toEqual([])
    expect(store.draft('t-1')).toEqual(blankRequest())
  })

  it('previews a suggestion as a question card can show it', () => {
    const preview = asPreview({ key: 'k-1', content: MC }, 't-1')

    expect(preview).toMatchObject({ id: 'k-1', topicId: 't-1', type: 'multiple_choice', active: true })
    expect(preview.options.map((o) => [o.text, o.correct])).toEqual([['Na', true], ['S', false]])
    expect(asPreview({ key: 'k-2', content: TF }, 't-1').options.map((o) => [o.text, o.correct])).toEqual([['Verdadeiro', true], ['Falso', false]])
  })
})
