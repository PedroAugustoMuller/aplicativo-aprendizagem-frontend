import { beforeEach, describe, expect, it, vi } from 'vitest'
import { quizRepository } from '@/modules/quiz/infrastructure/HttpQuizRepository'
import { quizRequests } from '@/modules/quiz/infrastructure/client/requests'
import { ApiError } from '@/shared/api/error'
import type { AttemptResponse } from '@/modules/quiz/infrastructure/interfaces/AttemptResponse'

vi.mock('@/modules/quiz/infrastructure/client/requests', () => ({
  quizRequests: { start: vi.fn(), get: vi.fn(), answer: vi.fn() },
}))

const ATTEMPT: AttemptResponse = {
  id: 'a-1',
  topic_id: 't-1',
  started_at: '2026-10-03T10:00:00+00:00',
  completed_at: null,
  score: { total: 2, answered: 1, correct: 1 },
  questions: [
    { id: 'q-2', position: 1, type: 'true_false', statement: 'O sódio é um metal.', options: [{ id: 'v', text: 'Verdadeiro' }, { id: 'f', text: 'Falso' }], result: null },
    {
      id: 'q-1', position: 0, type: 'multiple_choice', statement: 'Símbolo do sódio?', options: [{ id: 's', text: 'S' }, { id: 'na', text: 'Na' }],
      result: { question_id: 'q-1', option_id: 'na', correct: true, correct_option_id: 'na', explanation: 'Natrium.' },
    },
  ],
}

describe('HttpQuizRepository', () => {
  beforeEach(() => vi.resetAllMocks())

  it('starts with the client id and maps the attempt, questions in position order', async () => {
    vi.mocked(quizRequests.start).mockResolvedValue(ATTEMPT)

    const attempt = await quizRepository.start('t-1', 'a-1')

    expect(quizRequests.start).toHaveBeenCalledWith('t-1', { id: 'a-1' })
    expect(attempt).toEqual({
      id: 'a-1',
      topicId: 't-1',
      startedAt: '2026-10-03T10:00:00+00:00',
      completedAt: null,
      score: { total: 2, answered: 1, correct: 1 },
      questions: [
        {
          id: 'q-1', position: 0, type: 'multiple_choice', statement: 'Símbolo do sódio?',
          options: [{ id: 's', text: 'S' }, { id: 'na', text: 'Na' }],
          result: { questionId: 'q-1', optionId: 'na', correct: true, correctOptionId: 'na', explanation: 'Natrium.' },
        },
        {
          id: 'q-2', position: 1, type: 'true_false', statement: 'O sódio é um metal.',
          options: [{ id: 'v', text: 'Verdadeiro' }, { id: 'f', text: 'Falso' }],
          result: null,
        },
      ],
    })
  })

  it('reads an attempt', async () => {
    vi.mocked(quizRequests.get).mockResolvedValue(ATTEMPT)

    await expect(quizRepository.get('a-1')).resolves.toMatchObject({ id: 'a-1' })
    expect(quizRequests.get).toHaveBeenCalledWith('a-1')
  })

  it('sends an answer in snake_case and maps the outcome', async () => {
    vi.mocked(quizRequests.answer).mockResolvedValue({
      question_id: 'q-2', option_id: 'v', correct: false, correct_option_id: 'f', explanation: null,
      score: { total: 2, answered: 2, correct: 1 }, completed: true,
    })

    const outcome = await quizRepository.answer({ attemptId: 'a-1', answerId: 'ans-1', questionId: 'q-2', optionId: 'v', answeredAt: '2026-10-03T10:05:00.000Z' })

    expect(quizRequests.answer).toHaveBeenCalledWith('a-1', { answer_id: 'ans-1', question_id: 'q-2', option_id: 'v', answered_at: '2026-10-03T10:05:00.000Z' })
    expect(outcome).toEqual({
      result: { questionId: 'q-2', optionId: 'v', correct: false, correctOptionId: 'f', explanation: null },
      score: { total: 2, answered: 2, correct: 1 },
      completed: true,
    })
  })

  it('lets an ApiError through untouched', async () => {
    vi.mocked(quizRequests.get).mockRejectedValue(new ApiError('quiz.attempt_not_found', {}, 404))

    await expect(quizRepository.get('a-1')).rejects.toMatchObject({ code: 'quiz.attempt_not_found' })
  })
})
