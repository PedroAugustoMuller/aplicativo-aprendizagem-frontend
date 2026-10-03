import type { QuestionContent } from '@/modules/content/domain/Question'

/** Same limits as the backend's Question aggregate and Form Requests. */
export const QUESTION_LIMITS = {
  statement: 1000,
  explanation: 1000,
  option: 200,
  minOptions: 2,
  maxOptions: 5,
} as const

export type QuestionProblem =
  | 'statement_required'
  | 'statement_too_long'
  | 'explanation_too_long'
  | 'options_count'
  | 'option_empty'
  | 'option_too_long'
  | 'option_duplicate'
  | 'correct_count'

/** Characters as PHP's mb_strlen counts them (code points), not UTF-16 units. */
const length = (text: string): number => [...text].length

/** Two options that differ only in case or spacing are the same answer to a student. */
export function comparisonKey(text: string): string {
  return text.trim().replace(/\s+/gu, ' ').toLowerCase()
}

/**
 * Mirrors the server's rules so the form can explain a problem before sending.
 * The server still decides: this list only ever shows fewer problems than it would.
 */
export function questionProblems(content: QuestionContent): QuestionProblem[] {
  const problems: QuestionProblem[] = []
  const statement = content.statement.trim()

  if (statement === '') {
    problems.push('statement_required')
  } else if (length(statement) > QUESTION_LIMITS.statement) {
    problems.push('statement_too_long')
  }

  if (length((content.explanation ?? '').trim()) > QUESTION_LIMITS.explanation) {
    problems.push('explanation_too_long')
  }

  if (content.type === 'true_false') {
    return problems
  }

  const { options } = content

  if (options.length < QUESTION_LIMITS.minOptions || options.length > QUESTION_LIMITS.maxOptions) {
    problems.push('options_count')
  }

  const texts = options.map((option) => option.text.trim())

  if (texts.some((text) => text === '')) {
    problems.push('option_empty')
  }

  if (texts.some((text) => length(text) > QUESTION_LIMITS.option)) {
    problems.push('option_too_long')
  }

  const keys = texts.filter((text) => text !== '').map(comparisonKey)

  if (new Set(keys).size !== keys.length) {
    problems.push('option_duplicate')
  }

  if (options.filter((option) => option.correct).length !== 1) {
    problems.push('correct_count')
  }

  return problems
}
