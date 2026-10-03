import { createStore, del, get, keys, set } from 'idb-keyval'
import type { OfflineStorage } from '@/shared/offline/storage'
import type { PendingAnswer } from '@/modules/quiz/domain/Attempt'
import type { SavedQuiz } from '@/modules/quiz/domain/playState'

/** Everything the quiz keeps on the device, per user. */
export interface QuizVault {
  readQuiz(userId: string, attemptId: string): Promise<SavedQuiz | null>
  writeQuiz(userId: string, quiz: SavedQuiz): Promise<void>
  openAttemptId(userId: string, topicId: string): Promise<string | null>
  setOpen(userId: string, topicId: string, attemptId: string | null): Promise<void>
  outbox(userId: string): Promise<PendingAnswer[]>
  writeOutbox(userId: string, entries: readonly PendingAnswer[]): Promise<void>
  clear(userId: string): Promise<void>
}

const quizKey = (userId: string, attemptId: string): string => `${userId}:quiz:attempt:${attemptId}`
const openKey = (userId: string, topicId: string): string => `${userId}:quiz:open:${topicId}`
const outboxKey = (userId: string): string => `${userId}:quiz:outbox`

// IndexedDB cannot clone Vue's reactive proxies, and a later change to a live value
// must not reach what was saved: always store a plain copy. Everything here is JSON.
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

function isSavedQuiz(raw: unknown): raw is SavedQuiz {
  return typeof raw === 'object' && raw !== null && 'attempt' in raw && 'answers' in raw
}

// Only this module writes these keys, always with what the functions below received.
function isPendingList(raw: unknown): raw is PendingAnswer[] {
  return Array.isArray(raw)
}

export function createQuizVault(storage: OfflineStorage): QuizVault {
  return {
    async readQuiz(userId, attemptId) {
      const raw = await storage.get(quizKey(userId, attemptId))

      return isSavedQuiz(raw) ? raw : null
    },
    writeQuiz: (userId, quiz) => storage.set(quizKey(userId, quiz.attempt.id), plain(quiz)),
    async openAttemptId(userId, topicId) {
      const raw = await storage.get(openKey(userId, topicId))

      return typeof raw === 'string' ? raw : null
    },
    setOpen: (userId, topicId, attemptId) =>
      attemptId === null ? storage.delete(openKey(userId, topicId)) : storage.set(openKey(userId, topicId), attemptId),
    async outbox(userId) {
      const raw = await storage.get(outboxKey(userId))

      return isPendingList(raw) ? raw : []
    },
    writeOutbox: (userId, entries) => storage.set(outboxKey(userId), plain([...entries])),
    async clear(userId) {
      const prefix = `${userId}:`
      const all = await storage.keys()

      await Promise.all(all.filter((key) => key.startsWith(prefix)).map((key) => storage.delete(key)))
    },
  }
}

let idbStore: ReturnType<typeof createStore> | null = null
// Its own database, apart from the read cache: an expired session wipes saved reads
// (readThrough), never unsent answers. Created lazily: unit tests have no indexedDB.
const store = (): ReturnType<typeof createStore> => (idbStore ??= createStore('dp2-quiz', 'state'))

const idbQuizStorage: OfflineStorage = {
  get: (key) => get(key, store()),
  set: (key, value) => set(key, value, store()),
  delete: (key) => del(key, store()),
  keys: async () => (await keys(store())).filter((key): key is string => typeof key === 'string'),
}

export const quizVault: QuizVault = createQuizVault(idbQuizStorage)
