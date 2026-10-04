import { quizRequests } from '@/modules/quiz/infrastructure/client/requests'
import type { QuizRepository } from '@/modules/quiz/domain/QuizRepository'
import { toAttempt, toResult } from '@/modules/quiz/infrastructure/attemptMapping'

export const quizRepository: QuizRepository = {
  async start(topicId, attemptId) {
    return toAttempt(await quizRequests.start(topicId, { id: attemptId }))
  },

  async get(attemptId) {
    return toAttempt(await quizRequests.get(attemptId))
  },

  async answer(answer) {
    const response = await quizRequests.answer(answer.attemptId, {
      answer_id: answer.answerId,
      question_id: answer.questionId,
      option_id: answer.optionId,
      answered_at: answer.answeredAt,
    })

    return {
      result: toResult(response),
      score: { total: response.score.total, answered: response.score.answered, correct: response.score.correct },
      completed: response.completed,
    }
  },
}
