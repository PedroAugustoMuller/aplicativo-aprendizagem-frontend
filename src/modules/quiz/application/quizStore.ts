import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { quizRepository } from '@/modules/quiz/infrastructure/HttpQuizRepository'
import { quizVault } from '@/modules/quiz/infrastructure/persistence/quizVault'
import { withLock } from '@/modules/quiz/infrastructure/persistence/locks'
import { enqueue, flushOutbox, STATE_LOCK, type SyncDeps, type SyncOutcome } from '@/modules/quiz/application/quizSync'
import { fromServer, isFinished, progress, withPending, type QuizContext, type SavedQuiz } from '@/modules/quiz/domain/playState'
import { viewerId } from '@/shared/auth/viewer'
import { ApiError } from '@/shared/api/error'
import type { PendingAnswer } from '@/modules/quiz/domain/Attempt'

export interface OpenQuiz {
  readonly attemptId: string
  readonly answered: number
  readonly total: number
}

const NETWORK_FAILURES = new Set(['api.network_unavailable', 'api.request_timeout'])
const asApiError = (failure: unknown): ApiError =>
  failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')

export const useQuizStore = defineStore('quiz', () => {
  // Shallow: the saved quiz is replaced whole, never mutated, and must stay a plain object.
  const quiz = shallowRef<SavedQuiz | null>(null)
  const loading = ref(false)
  const error = ref<ApiError | null>(null)
  const pendingCount = ref(0)
  const sendingQuestion = ref<string | null>(null)
  const openByTopic = ref<Record<string, OpenQuiz>>({})
  // Questions whose answer is being saved right now, in this tab.
  const answering = new Set<string>()
  // Only the latest open() may write results; an older, slower one loses.
  let latest = 0

  const deps: SyncDeps = {
    vault: quizVault,
    repository: quizRepository,
    lock: withLock,
    onUpdated: (next) => {
      if (quiz.value?.attempt.id === next.attempt.id) {
        quiz.value = next
      }
    },
  }

  function requireUser(): string {
    const userId = viewerId()

    if (userId === null) {
      throw new ApiError('auth.unauthenticated')
    }

    return userId
  }

  async function refreshTopic(topicId: string): Promise<void> {
    const userId = viewerId()

    if (userId === null) {
      return
    }

    const attemptId = await quizVault.openAttemptId(userId, topicId)
    const saved = attemptId === null ? null : await quizVault.readQuiz(userId, attemptId)
    const rest = Object.fromEntries(Object.entries(openByTopic.value).filter(([id]) => id !== topicId))

    openByTopic.value = saved === null || isFinished(saved)
      ? rest
      : { ...rest, [topicId]: { attemptId: saved.attempt.id, answered: progress(saved).answered, total: progress(saved).total } }
  }

  /** Starts or downloads a quiz. The server may hand back the topic's open attempt instead. */
  async function prepare(topicId: string, context: QuizContext): Promise<string> {
    const userId = requireUser()
    const attempt = await quizRepository.start(topicId, globalThis.crypto.randomUUID())
    const saved = fromServer(attempt, await quizVault.readQuiz(userId, attempt.id), context)

    await quizVault.writeQuiz(userId, saved)
    await quizVault.setOpen(userId, topicId, isFinished(saved) ? null : attempt.id)
    await refreshTopic(topicId)

    return attempt.id
  }

  /** The saved copy first (it works offline), then the server's, merged over it. */
  async function open(attemptId: string): Promise<void> {
    const request = ++latest
    const userId = viewerId()
    loading.value = true
    error.value = null

    const local = userId === null ? null : await quizVault.readQuiz(userId, attemptId)

    if (request !== latest) {
      return
    }

    quiz.value = local

    try {
      const merged = fromServer(await quizRepository.get(attemptId), local)

      if (userId !== null) {
        await quizVault.writeQuiz(userId, merged)
      }

      if (request === latest) {
        quiz.value = merged
      }
    } catch (failure: unknown) {
      const apiError = asApiError(failure)

      // Offline with a saved copy: that copy is the quiz. Anything else is a real answer.
      if (request === latest && !(local !== null && NETWORK_FAILURES.has(apiError.code))) {
        error.value = apiError
        quiz.value = null
      }
    } finally {
      if (request === latest) {
        loading.value = false
      }
    }
  }

  async function refreshPending(): Promise<void> {
    const userId = viewerId()
    pendingCount.value = userId === null ? 0 : (await quizVault.outbox(userId)).length
  }

  async function sync(): Promise<SyncOutcome> {
    try {
      return await flushOutbox(deps, viewerId())
    } catch {
      // Storage itself failed: nothing was dropped, the next trigger tries again.
      return 'offline'
    } finally {
      await refreshPending().catch(() => undefined)
    }
  }

  async function answer(questionId: string, optionId: string): Promise<void> {
    const current = quiz.value
    const userId = viewerId()

    // Checked and set before any await: a double tap must not queue two answers.
    if (current === null || userId === null || current.answers[questionId] !== undefined || answering.has(questionId)) {
      return
    }

    answering.add(questionId)
    sendingQuestion.value = questionId

    try {
      const entry: PendingAnswer = {
        attemptId: current.attempt.id,
        answerId: globalThis.crypto.randomUUID(),
        questionId,
        optionId,
        answeredAt: new Date().toISOString(),
      }

      // Built on the saved copy, not this tab's memory, which another tab or a
      // flush may have moved on. On the device before any network call.
      const next = await withLock(STATE_LOCK, async () => {
        const saved = (await quizVault.readQuiz(userId, current.attempt.id)) ?? current

        if (saved.answers[questionId] !== undefined) {
          return saved
        }

        const pending = withPending(saved, questionId, optionId)
        await quizVault.writeQuiz(userId, pending)
        await enqueue(deps, userId, entry)

        return pending
      })

      if (isFinished(next)) {
        await quizVault.setOpen(userId, next.attempt.topicId, null)
      }

      quiz.value = next
      await refreshTopic(next.attempt.topicId)
      await sync()
    } finally {
      answering.delete(questionId)
      sendingQuestion.value = null
    }
  }

  async function pendingBeforeSignOut(): Promise<number> {
    await sync()

    return pendingCount.value
  }

  /** Called on an explicit sign-out only: an expired session keeps everything. */
  async function discardDeviceData(): Promise<void> {
    const userId = viewerId()

    if (userId !== null) {
      await quizVault.clear(userId).catch(() => undefined)
    }

    reset()
  }

  function reset(): void {
    latest += 1
    quiz.value = null
    loading.value = false
    error.value = null
    pendingCount.value = 0
    sendingQuestion.value = null
    openByTopic.value = {}
  }

  return {
    quiz,
    loading,
    error,
    pendingCount,
    sendingQuestion,
    openByTopic,
    refreshTopic,
    prepare,
    open,
    answer,
    sync,
    refreshPending,
    pendingBeforeSignOut,
    discardDeviceData,
    reset,
  }
})
