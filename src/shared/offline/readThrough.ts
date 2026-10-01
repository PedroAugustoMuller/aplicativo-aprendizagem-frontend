import { ApiError } from '@/shared/api/error'
import { idbStorage, type OfflineStorage } from '@/shared/offline/storage'

/** A value and, when it came from this device instead of the server, when it was saved. */
export interface Snapshot<T> {
  readonly value: T
  readonly savedAt: Date | null
}

interface SavedEntry {
  value: unknown
  savedAt: string
}

// Only "could not reach the server" falls back. A 403 or 404 is a real answer
// and must never be hidden behind stale data.
const NETWORK_FAILURES = new Set(['api.network_unavailable', 'api.request_timeout'])

let currentUserId: () => string | null = () => null
let storage: OfflineStorage = idbStorage

/** Wired once in main.ts, like configureApiSession: this module never imports a store. */
export function configureOffline(options: { userId: () => string | null; storage?: OfflineStorage | undefined }): void {
  currentUserId = options.userId
  storage = options.storage ?? idbStorage
}

const keyFor = (userId: string, key: string): string => `${userId}:${key}`

function isSavedEntry(raw: unknown): raw is SavedEntry {
  return typeof raw === 'object' && raw !== null && 'value' in raw && 'savedAt' in raw && typeof raw.savedAt === 'string'
}

export async function readThrough<T>(key: string, fetch: () => Promise<T>): Promise<Snapshot<T>> {
  const userId = currentUserId()

  try {
    const value = await fetch()

    if (userId !== null) {
      // Failing to save only costs the offline copy, never the live answer.
      await storage.set(keyFor(userId, key), { value, savedAt: new Date().toISOString() }).catch(() => undefined)
    }

    return { value, savedAt: null }
  } catch (failure: unknown) {
    if (userId === null || !(failure instanceof ApiError) || !NETWORK_FAILURES.has(failure.code)) {
      throw failure
    }

    const saved = await storage.get(keyFor(userId, key)).catch(() => undefined)

    if (!isSavedEntry(saved)) {
      throw failure
    }

    // Only this function writes under this key, always with what fetch() returned.
    return { value: saved.value as T, savedAt: new Date(saved.savedAt) }
  }
}

export async function clearOfflineData(userId: string): Promise<void> {
  const prefix = `${userId}:`
  const all = await storage.keys().catch((): string[] => [])

  await Promise.all(
    all.filter((key) => key.startsWith(prefix)).map((key) => storage.delete(key).catch(() => undefined)),
  )
}
