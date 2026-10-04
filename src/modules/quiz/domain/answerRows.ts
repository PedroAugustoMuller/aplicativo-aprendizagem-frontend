import type { AnswerState, SavedQuiz } from '@/modules/quiz/domain/playState'
import type { Attempt, QuizOption } from '@/modules/quiz/domain/Attempt'
import type { WrongQuestion } from '@/modules/quiz/domain/Progress'

export type RowStatus = 'correct' | 'wrong' | 'pending' | 'failed'

/** One question as a results or review list shows it. */
export interface AnswerRow {
  readonly id: string
  readonly statement: string
  readonly status: RowStatus
  readonly chosen: string
  readonly correct: string | null
  readonly explanation: string | null
}

const textOf = (options: readonly QuizOption[], id: string | undefined): string => options.find((option) => option.id === id)?.text ?? ''

function statusOf(state: AnswerState | undefined): RowStatus {
  if (state?.status === 'graded') {
    return state.result.correct ? 'correct' : 'wrong'
  }

  return state?.status === 'failed' ? 'failed' : 'pending'
}

/** The quiz as this device knows it: graded, waiting to be sent, or refused. */
export function rowsFromSavedQuiz(quiz: SavedQuiz): AnswerRow[] {
  return quiz.attempt.questions.map((question) => {
    const state = quiz.answers[question.id]

    return {
      id: question.id,
      statement: question.statement,
      status: statusOf(state),
      chosen: textOf(question.options, state?.optionId),
      correct: state?.status === 'graded' ? textOf(question.options, state.result.correctOptionId) : null,
      explanation: state?.status === 'graded' ? state.result.explanation : null,
    }
  })
}

/** The quiz as the server graded it. */
export function rowsFromAttempt(attempt: Attempt): AnswerRow[] {
  return attempt.questions.map((question) => {
    const result = question.result

    return {
      id: question.id,
      statement: question.statement,
      status: result === null ? 'pending' : result.correct ? 'correct' : 'wrong',
      chosen: textOf(question.options, result?.optionId),
      correct: result === null ? null : textOf(question.options, result.correctOptionId),
      explanation: result?.explanation ?? null,
    }
  })
}

export function rowsFromWrong(questions: readonly WrongQuestion[]): AnswerRow[] {
  return questions.map((question) => ({
    id: question.questionId,
    statement: question.statement,
    status: 'wrong',
    chosen: textOf(question.options, question.chosenOptionId),
    correct: textOf(question.options, question.correctOptionId),
    explanation: question.explanation,
  }))
}
