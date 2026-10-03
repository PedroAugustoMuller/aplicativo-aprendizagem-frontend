import { describe, expect, it } from 'vitest'
import { firstUnanswered, fromServer, isFinished, progress, withFailure, withPending, withResult } from '@/modules/quiz/domain/playState'
import type { Attempt, QuizQuestion } from '@/modules/quiz/domain/Attempt'

const question = (id: string, position: number, result: QuizQuestion['result'] = null): QuizQuestion => ({
  id, position, type: 'true_false', statement: `Afirmação ${id}`, options: [{ id: `${id}-v`, text: 'Verdadeiro' }, { id: `${id}-f`, text: 'Falso' }], result,
})

const attempt = (questions: QuizQuestion[]): Attempt => ({
  id: 'a-1', topicId: 't-1', startedAt: '2026-10-03T10:00:00+00:00', completedAt: null,
  score: { total: questions.length, answered: 0, correct: 0 }, questions,
})

const CONTEXT = { topicName: 'Tabela Periódica', subjectId: 's-1' }
const graded = (id: string, correct: boolean) => ({ questionId: id, optionId: `${id}-v`, correct, correctOptionId: correct ? `${id}-v` : `${id}-f`, explanation: null })

describe('playState', () => {
  it('builds answers from the server results', () => {
    const quiz = fromServer(attempt([question('q1', 0, graded('q1', true)), question('q2', 1)]), null, CONTEXT)

    expect(quiz.topicName).toBe('Tabela Periódica')
    expect(quiz.answers).toEqual({ q1: { status: 'graded', optionId: 'q1-v', result: graded('q1', true) } })
    expect(firstUnanswered(quiz)).toBe(1)
  })

  it('keeps local pending answers the server has not seen, and the previous context', () => {
    const before = withPending(fromServer(attempt([question('q1', 0), question('q2', 1)]), null, CONTEXT), 'q2', 'q2-f')

    const after = fromServer(attempt([question('q1', 0, graded('q1', false)), question('q2', 1)]), before)

    expect(after.subjectId).toBe('s-1')
    expect(after.answers.q2).toEqual({ status: 'pending', optionId: 'q2-f' })
    expect(after.answers.q1?.status).toBe('graded')
  })

  it('lets the server result replace a local pending answer', () => {
    const before = withPending(fromServer(attempt([question('q1', 0)]), null, CONTEXT), 'q1', 'q1-f')

    expect(fromServer(attempt([question('q1', 0, graded('q1', true))]), before).answers.q1?.status).toBe('graded')
  })

  it('never overwrites an answered question with a new pending one', () => {
    const once = withPending(fromServer(attempt([question('q1', 0)]), null, CONTEXT), 'q1', 'q1-v')

    expect(withPending(once, 'q1', 'q1-f')).toBe(once)
  })

  it('records a result and a failure, and counts them', () => {
    let quiz = fromServer(attempt([question('q1', 0), question('q2', 1), question('q3', 2)]), null, CONTEXT)
    quiz = withPending(withPending(withPending(quiz, 'q1', 'q1-v'), 'q2', 'q2-v'), 'q3', 'q3-v')
    quiz = withResult(quiz, graded('q1', true))
    quiz = withFailure(quiz, 'q2', 'quiz.answer.invalid_option')

    expect(quiz.answers.q2).toEqual({ status: 'failed', optionId: 'q2-v', errorCode: 'quiz.answer.invalid_option' })
    expect(progress(quiz)).toEqual({ total: 3, answered: 3, correct: 1, pending: 1, failed: 1 })
    expect(isFinished(quiz)).toBe(true)
    expect(firstUnanswered(quiz)).toBe(3)
  })

  it('marks a failure only on a pending answer', () => {
    const quiz = withResult(fromServer(attempt([question('q1', 0)]), null, CONTEXT), graded('q1', true))

    expect(withFailure(quiz, 'q1', 'x')).toBe(quiz)
  })
})
