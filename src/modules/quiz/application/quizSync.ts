import { ApiError } from '@/shared/api/error'
import { fromServer, withFailure, withResult, type SavedQuiz } from '@/modules/quiz/domain/playState'
import type { PendingAnswer } from '@/modules/quiz/domain/Attempt'
import type { QuizRepository } from '@/modules/quiz/domain/QuizRepository'
import type { QuizVault } from '@/modules/quiz/infrastructure/persistence/quizVault'

export type SyncOutcome = 'done' | 'offline' | 'unauthorized' | 'skipped'

export interface SyncDeps {
  readonly vault: QuizVault
  readonly repository: QuizRepository
  readonly lock: <T>(name: string, work: () => Promise<T>) => Promise<T>
  /** Every saved quiz a flush changed, so an open page can follow along. */
  readonly onUpdated: (quiz: SavedQuiz) => void
}

// Held for a whole flush: one sender at a time, so answers go in order.
const FLUSH_LOCK = 'dp2-quiz-flush'
// Held only around a read-modify-write of the outbox: a new answer is saved at once,
// even while a flush waits on the network.
const OUTBOX_LOCK = 'dp2-quiz-outbox'
const NETWORK_FAILURES = new Set(['api.network_unavailable', 'api.request_timeout'])

type Step = 'sent' | 'offline' | 'unauthorized'

const asApiError = (failure: unknown): ApiError =>
  failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')

function stopFor(error: ApiError): Step | null {
  if (NETWORK_FAILURES.has(error.code)) {
    return 'offline'
  }

  return error.isUnauthorized() ? 'unauthorized' : null
}

export function enqueue(deps: SyncDeps, userId: string, entry: PendingAnswer): Promise<void> {
  return deps.lock(OUTBOX_LOCK, async () => {
    await deps.vault.writeOutbox(userId, [...(await deps.vault.outbox(userId)), entry])
  })
}

function dequeue(deps: SyncDeps, userId: string, answerId: string): Promise<void> {
  return deps.lock(OUTBOX_LOCK, async () => {
    await deps.vault.writeOutbox(userId, (await deps.vault.outbox(userId)).filter((entry) => entry.answerId !== answerId))
  })
}

async function updateQuiz(deps: SyncDeps, userId: string, attemptId: string, change: (quiz: SavedQuiz) => SavedQuiz): Promise<void> {
  const saved = await deps.vault.readQuiz(userId, attemptId)

  if (saved === null) {
    return
  }

  const next = change(saved)
  await deps.vault.writeQuiz(userId, next)
  deps.onUpdated(next)
}

/** The question was answered on another device or tab: the server's answer is the answer. */
async function adoptServer(deps: SyncDeps, userId: string, entry: PendingAnswer): Promise<Step> {
  try {
    const attempt = await deps.repository.get(entry.attemptId)

    await updateQuiz(deps, userId, entry.attemptId, (quiz) => {
      const next = fromServer(attempt, quiz)

      return withFailure(next, entry.questionId, 'quiz.question.already_answered')
    })

    return 'sent'
  } catch (failure: unknown) {
    const error = asApiError(failure)
    const stop = stopFor(error)

    if (stop !== null) {
      return stop
    }

    await updateQuiz(deps, userId, entry.attemptId, (quiz) => withFailure(quiz, entry.questionId, error.code))

    return 'sent'
  }
}

async function send(deps: SyncDeps, userId: string, entry: PendingAnswer): Promise<Step> {
  try {
    const outcome = await deps.repository.answer(entry)
    await updateQuiz(deps, userId, entry.attemptId, (quiz) => withResult(quiz, outcome.result))

    return 'sent'
  } catch (failure: unknown) {
    const error = asApiError(failure)
    const stop = stopFor(error)

    if (stop !== null) {
      return stop
    }

    if (error.code === 'quiz.question.already_answered') {
      return adoptServer(deps, userId, entry)
    }

    // Retrying cannot fix any other answer: drop it and say why on that question.
    await updateQuiz(deps, userId, entry.attemptId, (quiz) => withFailure(quiz, entry.questionId, error.code))

    return 'sent'
  }
}

/** Sends queued answers oldest first; stops at the first sign the network or session is gone. */
export async function flushOutbox(deps: SyncDeps, userId: string | null): Promise<SyncOutcome> {
  if (userId === null) {
    return 'skipped'
  }

  return deps.lock(FLUSH_LOCK, async (): Promise<SyncOutcome> => {
    // Re-read every round: answers queued while this flush waits are sent too.
    let entry = (await deps.vault.outbox(userId))[0]

    while (entry !== undefined) {
      const step = await send(deps, userId, entry)

      if (step !== 'sent') {
        return step
      }

      await dequeue(deps, userId, entry.answerId)
      entry = (await deps.vault.outbox(userId))[0]
    }

    return 'done'
  })
}
