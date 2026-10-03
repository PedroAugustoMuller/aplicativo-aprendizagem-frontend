export type QuizQuestionType = 'multiple_choice' | 'true_false'

export interface QuizOption {
  readonly id: string
  readonly text: string
}

/** What the server reveals after an answer. Never present before answering. */
export interface AnswerResult {
  readonly questionId: string
  readonly optionId: string
  readonly correct: boolean
  readonly correctOptionId: string
  readonly explanation: string | null
}

export interface QuizQuestion {
  readonly id: string
  readonly position: number
  readonly type: QuizQuestionType
  readonly statement: string
  readonly options: readonly QuizOption[]
  readonly result: AnswerResult | null
}

export interface Score {
  readonly total: number
  readonly answered: number
  readonly correct: number
}

export interface Attempt {
  readonly id: string
  readonly topicId: string
  readonly startedAt: string
  readonly completedAt: string | null
  readonly score: Score
  readonly questions: readonly QuizQuestion[]
}

export interface AnswerOutcome {
  readonly result: AnswerResult
  readonly score: Score
  readonly completed: boolean
}

/** An answer saved on the device and not yet acknowledged by the server. */
export interface PendingAnswer {
  readonly attemptId: string
  /** Generated once, on the device: resending it never answers twice. */
  readonly answerId: string
  readonly questionId: string
  readonly optionId: string
  readonly answeredAt: string
}
