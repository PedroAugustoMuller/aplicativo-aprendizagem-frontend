import type { QuestionContent, QuestionType } from '@/modules/content/domain/Question'

export type Difficulty = 'easy' | 'medium' | 'hard'

/** What the teacher asks the AI for. Empty notes/sourceText mean "none". */
export interface SuggestionRequest {
  count: number
  types: QuestionType[]
  difficulty: Difficulty
  notes: string
  sourceText: string
}

/** One proposed question. `key` also becomes the question id when accepted, so a resend never duplicates. */
export interface QuestionSuggestion {
  readonly key: string
  readonly content: QuestionContent
}

export const SUGGESTION_LIMITS = {
  minCount: 1,
  maxCount: 10,
  defaultCount: 5,
  notes: 500,
  sourceText: 30_000,
  fileBytes: 20 * 1024 * 1024,
} as const

export function blankRequest(): SuggestionRequest {
  return { count: SUGGESTION_LIMITS.defaultCount, types: ['multiple_choice', 'true_false'], difficulty: 'medium', notes: '', sourceText: '' }
}

export type SourceFileProblem = 'too_large' | 'unsupported' | 'no_text' | 'unreadable'

export class SourceFileError extends Error {
  readonly problem: SourceFileProblem

  constructor(problem: SourceFileProblem) {
    super(problem)
    this.name = 'SourceFileError'
    this.problem = problem
  }
}
