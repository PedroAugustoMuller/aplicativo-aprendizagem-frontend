import { quizRequests } from '@/modules/quiz/infrastructure/client/requests'
import type { AnswerResult, Attempt } from '@/modules/quiz/domain/Attempt'
import type { QuizRepository } from '@/modules/quiz/domain/QuizRepository'
import type { AnswerResultResponse, AttemptResponse } from '@/modules/quiz/infrastructure/interfaces/AttemptResponse'

const toResult = (response: AnswerResultResponse): AnswerResult => ({
  questionId: response.question_id,
  optionId: response.option_id,
  correct: response.correct,
  correctOptionId: response.correct_option_id,
  explanation: response.explanation,
})

const toAttempt = (response: AttemptResponse): Attempt => ({
  id: response.id,
  topicId: response.topic_id,
  startedAt: response.started_at,
  completedAt: response.completed_at,
  score: { total: response.score.total, answered: response.score.answered, correct: response.score.correct },
  questions: [...response.questions]
    .sort((a, b) => a.position - b.position)
    .map((question) => ({
      id: question.id,
      position: question.position,
      type: question.type,
      statement: question.statement,
      options: question.options.map((option) => ({ id: option.id, text: option.text })),
      result: question.result === null ? null : toResult(question.result),
    })),
})

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
