import type { AnswerResult, Attempt } from '@/modules/quiz/domain/Attempt'

/** What the device knows about one question's answer. */
export type AnswerState =
  | { readonly status: 'graded'; readonly optionId: string; readonly result: AnswerResult }
  | { readonly status: 'pending'; readonly optionId: string }
  | { readonly status: 'failed'; readonly optionId: string; readonly errorCode: string }

/** Where the quiz came from, kept for its title and the way back. */
export interface QuizContext {
  readonly topicName: string
  readonly subjectId: string
}

/** A quiz as saved on the device: the server's attempt plus local answer states. */
export interface SavedQuiz extends QuizContext {
  readonly attempt: Attempt
  readonly answers: Readonly<Record<string, AnswerState>>
}

export interface Progress {
  readonly total: number
  readonly answered: number
  readonly correct: number
  readonly pending: number
  readonly failed: number
}

/** Server results win; a local answer survives only where the server has none yet. */
export function fromServer(attempt: Attempt, previous: SavedQuiz | null, context?: QuizContext): SavedQuiz {
  const answers: Record<string, AnswerState> = {}

  for (const question of attempt.questions) {
    const local = previous?.answers[question.id]

    if (question.result !== null) {
      answers[question.id] = { status: 'graded', optionId: question.result.optionId, result: question.result }
    } else if (local !== undefined) {
      answers[question.id] = local
    }
  }

  return {
    attempt,
    topicName: previous?.topicName ?? context?.topicName ?? '',
    subjectId: previous?.subjectId ?? context?.subjectId ?? '',
    answers,
  }
}

/** Answers are final: an answered question keeps its first answer. */
export function withPending(quiz: SavedQuiz, questionId: string, optionId: string): SavedQuiz {
  if (quiz.answers[questionId] !== undefined) {
    return quiz
  }

  return { ...quiz, answers: { ...quiz.answers, [questionId]: { status: 'pending', optionId } } }
}

export function withResult(quiz: SavedQuiz, result: AnswerResult): SavedQuiz {
  return { ...quiz, answers: { ...quiz.answers, [result.questionId]: { status: 'graded', optionId: result.optionId, result } } }
}

export function withFailure(quiz: SavedQuiz, questionId: string, errorCode: string): SavedQuiz {
  const current = quiz.answers[questionId]

  if (current?.status !== 'pending') {
    return quiz
  }

  return { ...quiz, answers: { ...quiz.answers, [questionId]: { status: 'failed', optionId: current.optionId, errorCode } } }
}

export function progress(quiz: SavedQuiz): Progress {
  const states = quiz.attempt.questions.map((question) => quiz.answers[question.id])

  return {
    total: states.length,
    answered: states.filter((state) => state !== undefined).length,
    correct: states.filter((state) => state?.status === 'graded' && state.result.correct).length,
    pending: states.filter((state) => state?.status === 'pending').length,
    failed: states.filter((state) => state?.status === 'failed').length,
  }
}

export function firstUnanswered(quiz: SavedQuiz): number {
  const index = quiz.attempt.questions.findIndex((question) => quiz.answers[question.id] === undefined)

  return index === -1 ? quiz.attempt.questions.length : index
}

export function isFinished(quiz: SavedQuiz): boolean {
  return firstUnanswered(quiz) === quiz.attempt.questions.length
}
