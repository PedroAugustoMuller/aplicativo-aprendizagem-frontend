import { beforeEach, describe, expect, it, vi } from 'vitest'
import { questionSuggestionRepository } from '@/modules/content/infrastructure/HttpQuestionSuggestionRepository'
import { api } from '@/shared/api/client'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))

describe('HttpQuestionSuggestionRepository', () => {
  beforeEach(() => vi.resetAllMocks())

  it('posts the request with a long timeout and maps both types', async () => {
    vi.mocked(api.post).mockResolvedValue([
      { type: 'multiple_choice', statement: 'Símbolo?', explanation: 'Natrium.', options: [{ text: 'Na', correct: true }, { text: 'S', correct: false }] },
      { type: 'true_false', statement: 'É metal.', explanation: null, correct: true },
    ])

    const result = await questionSuggestionRepository.suggest('t-1', { count: 2, types: ['multiple_choice', 'true_false'], difficulty: 'hard', notes: '', sourceText: 'Texto' })

    expect(api.post).toHaveBeenCalledWith({
      url: '/topics/:topicId/question-suggestions',
      urlParams: { topicId: 't-1' },
      data: { count: 2, types: ['multiple_choice', 'true_false'], difficulty: 'hard', notes: null, source_text: 'Texto' },
      timeoutMs: 55_000,
    })
    expect(result).toEqual([
      { type: 'multiple_choice', statement: 'Símbolo?', explanation: 'Natrium.', options: [{ id: null, text: 'Na', correct: true }, { id: null, text: 'S', correct: false }] },
      { type: 'true_false', statement: 'É metal.', explanation: null, answer: true },
    ])
  })
})
