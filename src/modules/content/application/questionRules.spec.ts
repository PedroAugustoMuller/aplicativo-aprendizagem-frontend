import { describe, expect, it } from 'vitest'
import { questionProblems } from '@/modules/content/domain/questionRules'
import type { OptionDraft, QuestionContent } from '@/modules/content/domain/Question'

const option = (text: string, correct = false): OptionDraft => ({ id: null, text, correct })
const mc = (options: OptionDraft[], statement = 'Símbolo do sódio?'): QuestionContent => ({
  type: 'multiple_choice',
  statement,
  explanation: null,
  options,
})

describe('questionProblems', () => {
  it('accepts a well-formed multiple-choice question', () => {
    expect(questionProblems(mc([option('Na', true), option('S')]))).toEqual([])
  })

  it('needs a statement within its limit', () => {
    expect(questionProblems(mc([option('Na', true), option('S')], '   '))).toEqual(['statement_required'])
    expect(questionProblems(mc([option('Na', true), option('S')], 'a'.repeat(1001)))).toEqual(['statement_too_long'])
  })

  it('counts characters, not UTF-16 units, like the server', () => {
    expect(questionProblems(mc([option('Na', true), option('S')], '😀'.repeat(1000)))).toEqual([])
  })

  it('needs 2 to 5 options and exactly one correct', () => {
    expect(questionProblems(mc([option('Na', true)]))).toEqual(['options_count'])
    expect(questionProblems(mc([option('A'), option('B')]))).toEqual(['correct_count'])
    expect(questionProblems(mc([option('A', true), option('B', true)]))).toEqual(['correct_count'])
  })

  it('treats options that differ only in case or spacing as repeated', () => {
    expect(questionProblems(mc([option('Na', true), option(' na ')]))).toEqual(['option_duplicate'])
    expect(questionProblems(mc([option('Cloreto de sódio', true), option('cloreto   de sódio')]))).toEqual(['option_duplicate'])
    expect(questionProblems(mc([option('H₂O', true), option('H2O')]))).toEqual([])
  })

  it('flags blank and overlong options', () => {
    expect(questionProblems(mc([option('Na', true), option('  ')]))).toEqual(['option_empty'])
    expect(questionProblems(mc([option('Na', true), option('a'.repeat(201))]))).toEqual(['option_too_long'])
  })

  it('checks only statement and explanation for true/false', () => {
    const tf: QuestionContent = { type: 'true_false', statement: 'x', explanation: 'a'.repeat(1001), answer: true }

    expect(questionProblems(tf)).toEqual(['explanation_too_long'])
  })
})
