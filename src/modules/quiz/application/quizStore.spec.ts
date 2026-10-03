import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useQuizStore } from '@/modules/quiz/application/quizStore'
import { quizRepository } from '@/modules/quiz/infrastructure/HttpQuizRepository'
import { quizVault } from '@/modules/quiz/infrastructure/persistence/quizVault'
import { configureViewerId } from '@/shared/auth/viewer'
import { withResult } from '@/modules/quiz/domain/playState'
import { ApiError } from '@/shared/api/error'
import type { Attempt } from '@/modules/quiz/domain/Attempt'
import type * as VaultModule from '@/modules/quiz/infrastructure/persistence/quizVault'

vi.mock('@/modules/quiz/infrastructure/HttpQuizRepository', () => ({
  quizRepository: { start: vi.fn(), get: vi.fn(), answer: vi.fn() },
}))
// A memory-backed vault: happy-dom has no IndexedDB.
vi.mock('@/modules/quiz/infrastructure/persistence/quizVault', async (importOriginal) => {
  const actual = await importOriginal<typeof VaultModule>()
  const { createMemoryStorage } = await import('@/shared/offline/storage')

  return { ...actual, quizVault: actual.createQuizVault(createMemoryStorage()) }
})

const ATTEMPT: Attempt = {
  id: 'a-1', topicId: 't-1', startedAt: 's', completedAt: null, score: { total: 2, answered: 0, correct: 0 },
  questions: ['q1', 'q2'].map((id, position) => ({
    id, position, type: 'true_false' as const, statement: id, options: [{ id: `${id}-v`, text: 'Verdadeiro' }, { id: `${id}-f`, text: 'Falso' }], result: null,
  })),
}
const CONTEXT = { topicName: 'Tabela Periódica', subjectId: 's-1' }
const graded = (questionId: string) => ({
  result: { questionId, optionId: `${questionId}-v`, correct: true, correctOptionId: `${questionId}-v`, explanation: null },
  score: ATTEMPT.score, completed: false,
})

describe('quizStore', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    configureViewerId(() => 'u-1')
    await quizVault.clear('u-1')
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001')
  })

  it('prepares a quiz with a client id, saves it and marks the topic open', async () => {
    vi.mocked(quizRepository.start).mockResolvedValue(ATTEMPT)
    const store = useQuizStore()

    await expect(store.prepare('t-1', CONTEXT)).resolves.toBe('a-1')

    expect(quizRepository.start).toHaveBeenCalledWith('t-1', '00000000-0000-4000-8000-000000000001')
    expect(store.openByTopic['t-1']).toEqual({ attemptId: 'a-1', answered: 0, total: 2 })
    await expect(quizVault.readQuiz('u-1', 'a-1')).resolves.toMatchObject({ topicName: 'Tabela Periódica' })
  })

  it('answers online: saved first, then graded', async () => {
    vi.mocked(quizRepository.start).mockResolvedValue(ATTEMPT)
    vi.mocked(quizRepository.get).mockResolvedValue(ATTEMPT)
    vi.mocked(quizRepository.answer).mockResolvedValue(graded('q1'))
    const store = useQuizStore()
    await store.prepare('t-1', CONTEXT)
    await store.open('a-1')

    await store.answer('q1', 'q1-v')

    expect(store.quiz?.answers.q1).toMatchObject({ status: 'graded' })
    expect(store.pendingCount).toBe(0)
    expect(store.sendingQuestion).toBeNull()
    expect(store.openByTopic['t-1']).toEqual({ attemptId: 'a-1', answered: 1, total: 2 })
  })

  it('answers offline: pending, queued, and the topic stays open until the last answer', async () => {
    vi.mocked(quizRepository.start).mockResolvedValue(ATTEMPT)
    vi.mocked(quizRepository.get).mockRejectedValue(new ApiError('api.network_unavailable'))
    vi.mocked(quizRepository.answer).mockRejectedValue(new ApiError('api.network_unavailable'))
    const store = useQuizStore()
    await store.prepare('t-1', CONTEXT)
    await store.open('a-1')

    await store.answer('q1', 'q1-v')
    expect(store.quiz?.answers.q1).toEqual({ status: 'pending', optionId: 'q1-v' })
    expect(store.pendingCount).toBe(1)

    await store.answer('q2', 'q2-f')
    expect(store.pendingCount).toBe(2)
    expect(store.openByTopic['t-1']).toBeUndefined()
  })

  it('opens the saved copy offline', async () => {
    vi.mocked(quizRepository.start).mockResolvedValue(ATTEMPT)
    vi.mocked(quizRepository.get).mockRejectedValue(new ApiError('api.network_unavailable'))
    await useQuizStore().prepare('t-1', CONTEXT)
    setActivePinia(createPinia())
    const store = useQuizStore()

    await store.open('a-1')

    expect(store.error).toBeNull()
    expect(store.quiz?.attempt.id).toBe('a-1')
    expect(store.quiz?.topicName).toBe('Tabela Periódica')
  })

  it('merges the server copy over the saved one when online', async () => {
    vi.mocked(quizRepository.start).mockResolvedValue(ATTEMPT)
    vi.mocked(quizRepository.get).mockResolvedValue({ ...ATTEMPT, questions: [{ ...ATTEMPT.questions[0]!, result: graded('q1').result }, ATTEMPT.questions[1]!] })
    const store = useQuizStore()
    await store.prepare('t-1', CONTEXT)

    await store.open('a-1')

    expect(store.quiz?.answers.q1).toMatchObject({ status: 'graded' })
    expect(store.quiz?.topicName).toBe('Tabela Periódica')
  })

  it('shows a real error when nothing was saved, or the server refuses', async () => {
    vi.mocked(quizRepository.get).mockRejectedValue(new ApiError('quiz.attempt_not_found', {}, 404))
    const store = useQuizStore()

    await store.open('a-9')

    expect(store.error?.code).toBe('quiz.attempt_not_found')
    expect(store.quiz).toBeNull()
  })

  it('tries to send before sign-out and reports what is left', async () => {
    vi.mocked(quizRepository.start).mockResolvedValue(ATTEMPT)
    vi.mocked(quizRepository.get).mockRejectedValue(new ApiError('api.network_unavailable'))
    vi.mocked(quizRepository.answer).mockRejectedValue(new ApiError('api.network_unavailable'))
    const store = useQuizStore()
    await store.prepare('t-1', CONTEXT)
    await store.open('a-1')
    await store.answer('q1', 'q1-v')

    await expect(store.pendingBeforeSignOut()).resolves.toBe(1)

    await store.discardDeviceData()
    await expect(quizVault.outbox('u-1')).resolves.toEqual([])
    expect(store.quiz).toBeNull()
  })

  it('reads the open quiz of a topic from the device', async () => {
    vi.mocked(quizRepository.start).mockResolvedValue(ATTEMPT)
    await useQuizStore().prepare('t-1', CONTEXT)
    setActivePinia(createPinia())
    const store = useQuizStore()

    await store.refreshTopic('t-1')

    expect(store.openByTopic['t-1']?.attemptId).toBe('a-1')
  })

  it('answers on top of the saved copy, not a stale one in memory', async () => {
    vi.mocked(quizRepository.start).mockResolvedValue(ATTEMPT)
    vi.mocked(quizRepository.get).mockRejectedValue(new ApiError('api.network_unavailable'))
    vi.mocked(quizRepository.answer).mockRejectedValue(new ApiError('api.network_unavailable'))
    const store = useQuizStore()
    await store.prepare('t-1', CONTEXT)
    await store.open('a-1')
    // Another tab graded q1 meanwhile; this tab's memory still has it unanswered.
    const saved = await quizVault.readQuiz('u-1', 'a-1')
    await quizVault.writeQuiz('u-1', withResult(saved!, graded('q1').result))

    await store.answer('q2', 'q2-v')

    expect((await quizVault.readQuiz('u-1', 'a-1'))?.answers.q1).toMatchObject({ status: 'graded' })
  })

  it('queues one answer when Responder is tapped twice', async () => {
    vi.mocked(quizRepository.start).mockResolvedValue(ATTEMPT)
    vi.mocked(quizRepository.get).mockRejectedValue(new ApiError('api.network_unavailable'))
    vi.mocked(quizRepository.answer).mockRejectedValue(new ApiError('api.network_unavailable'))
    vi.mocked(globalThis.crypto.randomUUID).mockReturnValueOnce('00000000-0000-4000-8000-00000000000a').mockReturnValueOnce('00000000-0000-4000-8000-00000000000b')
    const store = useQuizStore()
    await store.prepare('t-1', CONTEXT)
    await store.open('a-1')

    await Promise.all([store.answer('q1', 'q1-v'), store.answer('q1', 'q1-f')])

    await expect(quizVault.outbox('u-1')).resolves.toHaveLength(1)
  })
})
