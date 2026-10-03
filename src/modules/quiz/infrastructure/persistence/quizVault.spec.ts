import { describe, expect, it } from 'vitest'
import { createQuizVault } from '@/modules/quiz/infrastructure/persistence/quizVault'
import { createMemoryStorage } from '@/shared/offline/storage'
import { fromServer } from '@/modules/quiz/domain/playState'
import { reactive } from 'vue'

const QUIZ = fromServer({
  id: 'a-1', topicId: 't-1', startedAt: 's', completedAt: null, score: { total: 0, answered: 0, correct: 0 }, questions: [],
}, null, { topicName: 'Átomos', subjectId: 's-1' })
const ENTRY = { attemptId: 'a-1', answerId: 'ans-1', questionId: 'q-1', optionId: 'o-1', answeredAt: '2026-10-03T10:00:00.000Z' }

describe('quizVault', () => {
  it('keeps quizzes, the open quiz per topic and the outbox per user', async () => {
    const storage = createMemoryStorage()
    const vault = createQuizVault(storage)

    await vault.writeQuiz('u-1', QUIZ)
    await vault.setOpen('u-1', 't-1', 'a-1')
    await vault.writeOutbox('u-1', [ENTRY])

    await expect(vault.readQuiz('u-1', 'a-1')).resolves.toEqual(QUIZ)
    await expect(vault.openAttemptId('u-1', 't-1')).resolves.toBe('a-1')
    await expect(vault.outbox('u-1')).resolves.toEqual([ENTRY])
    await expect(vault.readQuiz('u-2', 'a-1')).resolves.toBeNull()
    await expect(vault.outbox('u-2')).resolves.toEqual([])
    expect((await storage.keys()).every((key) => key.startsWith('u-1:'))).toBe(true)
  })

  it('stores plain copies, so a reactive value can be saved to IndexedDB', async () => {
    const storage = createMemoryStorage()
    const vault = createQuizVault(storage)
    const live = reactive({ ...QUIZ })

    await vault.writeQuiz('u-1', live)
    live.topicName = 'changed'

    await expect(vault.readQuiz('u-1', 'a-1')).resolves.toMatchObject({ topicName: 'Átomos' })
  })

  it('clears the open marker and everything of one user only', async () => {
    const vault = createQuizVault(createMemoryStorage())
    await vault.writeQuiz('u-1', QUIZ)
    await vault.writeQuiz('u-2', QUIZ)
    await vault.setOpen('u-1', 't-1', 'a-1')

    await vault.setOpen('u-1', 't-1', null)
    await expect(vault.openAttemptId('u-1', 't-1')).resolves.toBeNull()

    await vault.clear('u-1')
    await expect(vault.readQuiz('u-1', 'a-1')).resolves.toBeNull()
    await expect(vault.readQuiz('u-2', 'a-1')).resolves.toEqual(QUIZ)
  })

  it('treats unreadable entries as absent', async () => {
    const storage = createMemoryStorage()
    await storage.set('u-1:quiz:attempt:a-1', 'garbage')
    await storage.set('u-1:quiz:outbox', { not: 'a list' })

    const vault = createQuizVault(storage)

    await expect(vault.readQuiz('u-1', 'a-1')).resolves.toBeNull()
    await expect(vault.outbox('u-1')).resolves.toEqual([])
  })
})
