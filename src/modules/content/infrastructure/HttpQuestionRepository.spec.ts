import { beforeEach, describe, expect, it, vi } from 'vitest'
import { questionRepository } from '@/modules/content/infrastructure/HttpQuestionRepository'
import { contentRequests } from '@/modules/content/infrastructure/client/requests'
import { ApiError } from '@/shared/api/error'
import type { QuestionResponse } from '@/modules/content/infrastructure/interfaces/QuestionResponse'

vi.mock('@/modules/content/infrastructure/client/requests', () => ({
  contentRequests: {
    listQuestions: vi.fn(),
    createQuestion: vi.fn(),
    updateQuestion: vi.fn(),
    deactivateQuestion: vi.fn(),
    reactivateQuestion: vi.fn(),
  },
}))

const SODIUM: QuestionResponse = {
  id: 'q-1',
  topic_id: 't-1',
  type: 'multiple_choice',
  statement: 'Símbolo do sódio?',
  explanation: null,
  active: true,
  version: 2,
  options: [
    { id: 'o-2', text: 'S', correct: false, position: 1 },
    { id: 'o-1', text: 'Na', correct: true, position: 0 },
  ],
}

describe('HttpQuestionRepository', () => {
  beforeEach(() => vi.resetAllMocks())

  it('maps the bank, options in position order', async () => {
    vi.mocked(contentRequests.listQuestions).mockResolvedValue([SODIUM])

    await expect(questionRepository.listByTopic('t-1')).resolves.toEqual([{
      id: 'q-1',
      topicId: 't-1',
      type: 'multiple_choice',
      statement: 'Símbolo do sódio?',
      explanation: null,
      active: true,
      version: 2,
      options: [{ id: 'o-1', text: 'Na', correct: true }, { id: 'o-2', text: 'S', correct: false }],
    }])
    expect(contentRequests.listQuestions).toHaveBeenCalledWith('t-1')
  })

  it('sends a multiple-choice create with option ids only for existing options', async () => {
    vi.mocked(contentRequests.createQuestion).mockResolvedValue(SODIUM)

    await questionRepository.create('t-1', 'q-1', {
      type: 'multiple_choice',
      statement: 'Símbolo do sódio?',
      explanation: null,
      options: [{ id: null, text: 'Na', correct: true }, { id: 'o-2', text: 'S', correct: false }],
    })

    expect(contentRequests.createQuestion).toHaveBeenCalledWith('t-1', {
      id: 'q-1',
      type: 'multiple_choice',
      statement: 'Símbolo do sódio?',
      explanation: null,
      options: [{ text: 'Na', correct: true }, { id: 'o-2', text: 'S', correct: false }],
    })
  })

  it('sends a true/false edit as `correct` with the version read', async () => {
    vi.mocked(contentRequests.updateQuestion).mockResolvedValue({ ...SODIUM, type: 'true_false' })

    await questionRepository.update('q-1', 4, { type: 'true_false', statement: 'x', explanation: 'y', answer: false })

    expect(contentRequests.updateQuestion).toHaveBeenCalledWith('q-1', { version: 4, statement: 'x', explanation: 'y', correct: false })
  })

  it('deactivates and reactivates by id', async () => {
    vi.mocked(contentRequests.deactivateQuestion).mockResolvedValue({ ...SODIUM, active: false })
    vi.mocked(contentRequests.reactivateQuestion).mockResolvedValue(SODIUM)

    await expect(questionRepository.deactivate('q-1')).resolves.toMatchObject({ active: false })
    await expect(questionRepository.reactivate('q-1')).resolves.toMatchObject({ active: true })
  })

  it('lets an ApiError propagate', async () => {
    vi.mocked(contentRequests.updateQuestion).mockRejectedValue(new ApiError('content.question.edited_elsewhere', {}, 409))

    await expect(questionRepository.update('q-1', 1, { type: 'true_false', statement: 'x', explanation: null, answer: true }))
      .rejects.toBeInstanceOf(ApiError)
  })
})
