import { describe, expect, it } from 'vitest'
import { rowsFromAttempt, rowsFromWrong } from '@/modules/quiz/domain/answerRows'
import type { Attempt } from '@/modules/quiz/domain/Attempt'

const ATTEMPT: Attempt = {
  id: 'a-1', topicId: 't-1', startedAt: 's', completedAt: 'c', score: { total: 2, answered: 1, correct: 0 },
  questions: [
    {
      id: 'q1', position: 0, type: 'multiple_choice', statement: 'Sódio?', options: [{ id: 'na', text: 'Na' }, { id: 's', text: 'S' }],
      result: { questionId: 'q1', optionId: 's', correct: false, correctOptionId: 'na', explanation: 'Natrium.' },
    },
    { id: 'q2', position: 1, type: 'true_false', statement: 'Ouro é Au?', options: [{ id: 'v', text: 'Verdadeiro' }, { id: 'f', text: 'Falso' }], result: null },
  ],
}

describe('answer rows', () => {
  it('reads a server attempt, an unanswered question as pending', () => {
    expect(rowsFromAttempt(ATTEMPT)).toEqual([
      { id: 'q1', statement: 'Sódio?', status: 'wrong', chosen: 'S', correct: 'Na', explanation: 'Natrium.' },
      { id: 'q2', statement: 'Ouro é Au?', status: 'pending', chosen: '', correct: null, explanation: null },
    ])
  })

  it('reads the study list as wrong answers', () => {
    expect(rowsFromWrong([{
      questionId: 'q1', type: 'multiple_choice', statement: 'Sódio?', options: [{ id: 'na', text: 'Na' }, { id: 's', text: 'S' }],
      chosenOptionId: 's', correctOptionId: 'na', explanation: null, answeredAt: 'x',
    }])).toEqual([{ id: 'q1', statement: 'Sódio?', status: 'wrong', chosen: 'S', correct: 'Na', explanation: null }])
  })
})
