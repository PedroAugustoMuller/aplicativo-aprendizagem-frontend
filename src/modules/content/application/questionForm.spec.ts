import { describe, expect, it } from 'vitest'
import {
  blankForm,
  contentFromForm,
  copyForm,
  formFromQuestion,
  formProblems,
  sameForm,
} from '@/modules/content/application/questionForm'
import type { Question } from '@/modules/content/domain/Question'

let next = 0
const newKey = (): string => `k-${++next}`

const SODIUM: Question = {
  id: 'q-1',
  topicId: 't-1',
  type: 'multiple_choice',
  statement: 'Símbolo do sódio?',
  explanation: null,
  active: true,
  version: 3,
  options: [{ id: 'o-1', text: 'Na', correct: true }, { id: 'o-2', text: 'S', correct: false }],
}

describe('questionForm', () => {
  it('starts with two empty options and nothing chosen', () => {
    const form = blankForm('multiple_choice', newKey)

    expect(form.options).toHaveLength(2)
    expect(form.options.every((option) => option.id === null && option.text === '')).toBe(true)
    expect(form.correctKey).toBeNull()
    expect(form.answer).toBeNull()
  })

  it('round-trips an existing question, keeping option ids', () => {
    const form = formFromQuestion(SODIUM)

    expect(form.correctKey).toBe('o-1')
    expect(contentFromForm(form)).toEqual({
      type: 'multiple_choice',
      statement: 'Símbolo do sódio?',
      explanation: null,
      options: [{ id: 'o-1', text: 'Na', correct: true }, { id: 'o-2', text: 'S', correct: false }],
    })
  })

  it('reads a true/false answer from the "Verdadeiro" option', () => {
    const form = formFromQuestion({
      ...SODIUM,
      type: 'true_false',
      options: [{ id: 'v', text: 'Verdadeiro', correct: false }, { id: 'f', text: 'Falso', correct: true }],
    })

    expect(form.answer).toBe(false)
    expect(form.options).toEqual([])
    expect(contentFromForm(form)).toEqual({ type: 'true_false', statement: 'Símbolo do sódio?', explanation: null, answer: false })
  })

  it('trims text and turns a blank explanation into none', () => {
    const form = blankForm('true_false', newKey)
    form.statement = '  x  '
    form.explanation = '   '
    form.answer = true

    expect(contentFromForm(form)).toEqual({ type: 'true_false', statement: 'x', explanation: null, answer: true })
  })

  it('asks for a true/false answer before anything is chosen', () => {
    const form = blankForm('true_false', newKey)
    form.statement = 'x'

    expect(formProblems(form)).toEqual(['answer_required'])
  })

  it('knows when the form differs from what it started as, without sharing option rows', () => {
    const start = formFromQuestion(SODIUM)
    const form = copyForm(start)

    expect(sameForm(form, start)).toBe(true)
    const second = form.options[1]
    if (second === undefined) {
      throw new Error('expected a second option')
    }
    second.text = 'Sd'
    expect(sameForm(form, start)).toBe(false)
    expect(start.options[1]?.text).toBe('S')
  })

  it('counts choosing an answer on a blank true/false form as a change', () => {
    const start = blankForm('true_false', newKey)
    const form = copyForm(start)
    form.answer = false

    expect(sameForm(form, start)).toBe(false)
  })
})
