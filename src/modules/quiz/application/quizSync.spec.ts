import { beforeEach, describe, expect, it, vi } from 'vitest'
import { enqueue, flushOutbox, type SyncDeps } from '@/modules/quiz/application/quizSync'
import { createQuizVault, type QuizVault } from '@/modules/quiz/infrastructure/persistence/quizVault'
import { withLock } from '@/modules/quiz/infrastructure/persistence/locks'
import { createMemoryStorage } from '@/shared/offline/storage'
import { fromServer, withPending, type SavedQuiz } from '@/modules/quiz/domain/playState'
import { ApiError } from '@/shared/api/error'
import type { Attempt, PendingAnswer } from '@/modules/quiz/domain/Attempt'
import type { QuizRepository } from '@/modules/quiz/domain/QuizRepository'

const ATTEMPT: Attempt = {
  id: 'a-1', topicId: 't-1', startedAt: 's', completedAt: null, score: { total: 2, answered: 0, correct: 0 },
  questions: ['q1', 'q2'].map((id, position) => ({
    id, position, type: 'true_false' as const, statement: id, options: [{ id: `${id}-v`, text: 'Verdadeiro' }, { id: `${id}-f`, text: 'Falso' }], result: null,
  })),
}
const entry = (questionId: string, answerId = `ans-${questionId}`): PendingAnswer => ({
  attemptId: 'a-1', answerId, questionId, optionId: `${questionId}-v`, answeredAt: '2026-10-03T10:00:00.000Z',
})
const result = (questionId: string) => ({ questionId, optionId: `${questionId}-v`, correct: true, correctOptionId: `${questionId}-v`, explanation: 'Porque sim.' })

let vault: QuizVault
let repository: { start: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn>; answer: ReturnType<typeof vi.fn> }
let updated: SavedQuiz[]
let deps: SyncDeps

async function seed(...questionIds: string[]): Promise<void> {
  let quiz = fromServer(ATTEMPT, null, { topicName: 'T', subjectId: 's' })

  for (const id of questionIds) {
    quiz = withPending(quiz, id, `${id}-v`)
    await enqueue(deps, 'u-1', entry(id))
  }

  await vault.writeQuiz('u-1', quiz)
}

describe('quizSync', () => {
  beforeEach(() => {
    vault = createQuizVault(createMemoryStorage())
    repository = { start: vi.fn(), get: vi.fn(), answer: vi.fn() }
    updated = []
    deps = { vault, repository: repository as unknown as QuizRepository, lock: withLock, onUpdated: (quiz) => updated.push(quiz) }
  })

  it('sends queued answers in order and records each result', async () => {
    await seed('q1', 'q2')
    repository.answer.mockImplementation(async (answer: PendingAnswer) => ({ result: result(answer.questionId), score: ATTEMPT.score, completed: false }))

    await expect(flushOutbox(deps, 'u-1')).resolves.toBe('done')

    expect(repository.answer.mock.calls.map(([answer]) => (answer as PendingAnswer).questionId)).toEqual(['q1', 'q2'])
    await expect(vault.outbox('u-1')).resolves.toEqual([])
    expect((await vault.readQuiz('u-1', 'a-1'))?.answers.q2).toMatchObject({ status: 'graded' })
    expect(updated).toHaveLength(2)
  })

  it('stops at the first network failure and keeps the rest', async () => {
    await seed('q1', 'q2')
    repository.answer.mockRejectedValue(new ApiError('api.network_unavailable'))

    await expect(flushOutbox(deps, 'u-1')).resolves.toBe('offline')

    expect(repository.answer).toHaveBeenCalledTimes(1)
    await expect(vault.outbox('u-1')).resolves.toHaveLength(2)
    expect((await vault.readQuiz('u-1', 'a-1'))?.answers.q1).toEqual({ status: 'pending', optionId: 'q1-v' })
  })

  it('pauses on 401 and keeps the entry for the next login', async () => {
    await seed('q1')
    repository.answer.mockRejectedValue(new ApiError('auth.unauthenticated', {}, 401))

    await expect(flushOutbox(deps, 'u-1')).resolves.toBe('unauthorized')
    await expect(vault.outbox('u-1')).resolves.toHaveLength(1)
  })

  it('adopts the server answer when the question was answered elsewhere', async () => {
    await seed('q1')
    repository.answer.mockRejectedValue(new ApiError('quiz.question.already_answered', {}, 409))
    repository.get.mockResolvedValue({
      ...ATTEMPT,
      questions: ATTEMPT.questions.map((q) => (q.id === 'q1' ? { ...q, result: { ...result('q1'), optionId: 'q1-f', correct: false } } : q)),
    })

    await expect(flushOutbox(deps, 'u-1')).resolves.toBe('done')

    expect((await vault.readQuiz('u-1', 'a-1'))?.answers.q1).toMatchObject({ status: 'graded', optionId: 'q1-f' })
    await expect(vault.outbox('u-1')).resolves.toEqual([])
  })

  it('drops an answer retrying cannot fix and says why on that question', async () => {
    await seed('q1', 'q2')
    repository.answer
      .mockRejectedValueOnce(new ApiError('quiz.answer.invalid_option', {}, 422))
      .mockResolvedValueOnce({ result: result('q2'), score: ATTEMPT.score, completed: false })

    await expect(flushOutbox(deps, 'u-1')).resolves.toBe('done')

    const quiz = await vault.readQuiz('u-1', 'a-1')
    expect(quiz?.answers.q1).toEqual({ status: 'failed', optionId: 'q1-v', errorCode: 'quiz.answer.invalid_option' })
    expect(quiz?.answers.q2).toMatchObject({ status: 'graded' })
  })

  it('does not lose an answer queued while a flush is running', async () => {
    await seed('q1')
    let release: () => void = () => undefined
    repository.answer.mockImplementation(async (answer: PendingAnswer) => {
      if (answer.questionId === 'q1') {
        await new Promise<void>((resolve) => {
          release = resolve
        })
      }

      return { result: result(answer.questionId), score: ATTEMPT.score, completed: false }
    })

    const flushing = flushOutbox(deps, 'u-1')
    await vi.waitFor(() => expect(repository.answer).toHaveBeenCalledTimes(1))
    await enqueue(deps, 'u-1', entry('q2'))
    release()

    await expect(flushing).resolves.toBe('done')
    expect(repository.answer).toHaveBeenCalledTimes(2)
    await expect(vault.outbox('u-1')).resolves.toEqual([])
  })

  it('does nothing without a user', async () => {
    await expect(flushOutbox(deps, null)).resolves.toBe('skipped')
  })
})
