export type QuestionType = 'multiple_choice' | 'true_false'

export interface QuestionOption {
  readonly id: string
  readonly text: string
  readonly correct: boolean
}

/** A question of a topic's bank, as its authors see it (with the answer). */
export interface Question {
  readonly id: string
  readonly topicId: string
  readonly type: QuestionType
  readonly statement: string
  readonly explanation: string | null
  readonly active: boolean
  /** Sent back on edit; the server refuses an edit made from an older version. */
  readonly version: number
  /** In display order. True/false: "Verdadeiro", then "Falso". */
  readonly options: readonly QuestionOption[]
}

/** An option as the author typed it: `id` is null for a new option. */
export interface OptionDraft {
  readonly id: string | null
  readonly text: string
  readonly correct: boolean
}

export type QuestionContent =
  | {
      readonly type: 'multiple_choice'
      readonly statement: string
      readonly explanation: string | null
      readonly options: readonly OptionDraft[]
    }
  | {
      readonly type: 'true_false'
      readonly statement: string
      readonly explanation: string | null
      readonly answer: boolean
    }
