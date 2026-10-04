import type { AnswerResult, Attempt } from '@/modules/quiz/domain/Attempt'
import type { AnswerResultResponse, AttemptResponse } from '@/modules/quiz/infrastructure/interfaces/AttemptResponse'

export const toResult = (response: AnswerResultResponse): AnswerResult => ({
  questionId: response.question_id,
  optionId: response.option_id,
  correct: response.correct,
  correctOptionId: response.correct_option_id,
  explanation: response.explanation,
})

export const toAttempt = (response: AttemptResponse): Attempt => ({
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
