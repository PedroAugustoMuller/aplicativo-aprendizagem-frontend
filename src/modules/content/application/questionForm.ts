import { questionProblems, type QuestionProblem } from '@/modules/content/domain/questionRules'
import type { Question, QuestionContent, QuestionType } from '@/modules/content/domain/Question'

/** One option row; `key` is stable across edits so Vue keeps each input's state. */
export interface OptionField {
  key: string
  id: string | null
  text: string
}

export interface QuestionForm {
  type: QuestionType
  statement: string
  explanation: string
  /** Multiple choice only. */
  options: OptionField[]
  /** Multiple choice: the key of the correct option. */
  correctKey: string | null
  /** True/false: whether the statement is true; null until chosen. */
  answer: boolean | null
}

export type FormProblem = QuestionProblem | 'answer_required'

export function blankForm(type: QuestionType, newKey: () => string): QuestionForm {
  return {
    type,
    statement: '',
    explanation: '',
    options: [
      { key: newKey(), id: null, text: '' },
      { key: newKey(), id: null, text: '' },
    ],
    correctKey: null,
    answer: null,
  }
}

export function formFromQuestion(question: Question): QuestionForm {
  const multipleChoice = question.type === 'multiple_choice'

  return {
    type: question.type,
    statement: question.statement,
    explanation: question.explanation ?? '',
    options: multipleChoice ? question.options.map((option) => ({ key: option.id, id: option.id, text: option.text })) : [],
    correctKey: multipleChoice ? (question.options.find((option) => option.correct)?.id ?? null) : null,
    // True/false options are always "Verdadeiro" then "Falso".
    answer: multipleChoice ? null : (question.options[0]?.correct ?? null),
  }
}

export function copyForm(form: QuestionForm): QuestionForm {
  return { ...form, options: form.options.map((option) => ({ ...option })) }
}

export function contentFromForm(form: QuestionForm): QuestionContent {
  const statement = form.statement.trim()
  const explanation = form.explanation.trim() === '' ? null : form.explanation.trim()

  if (form.type === 'true_false') {
    return { type: 'true_false', statement, explanation, answer: form.answer === true }
  }

  return {
    type: 'multiple_choice',
    statement,
    explanation,
    options: form.options.map((option) => ({
      id: option.id,
      text: option.text.trim(),
      correct: option.key === form.correctKey,
    })),
  }
}

export function formProblems(form: QuestionForm): FormProblem[] {
  const problems: FormProblem[] = questionProblems(contentFromForm(form))

  if (form.type === 'true_false' && form.answer === null) {
    problems.push('answer_required')
  }

  return problems
}

export function sameForm(a: QuestionForm, b: QuestionForm): boolean {
  return a.answer === b.answer && JSON.stringify(contentFromForm(a)) === JSON.stringify(contentFromForm(b))
}
