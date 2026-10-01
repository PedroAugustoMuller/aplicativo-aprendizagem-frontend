import { createStore, del, get, keys, set } from 'idb-keyval'

/** Where saved reads live: IndexedDB in the app, a Map in unit tests. */
export interface OfflineStorage {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<void>
  keys(): Promise<string[]>
}

export function createMemoryStorage(): OfflineStorage {
  const entries = new Map<string, unknown>()

  return {
    get: async (key) => entries.get(key),
    set: async (key, value) => {
      entries.set(key, value)
    },
    delete: async (key) => {
      entries.delete(key)
    },
    keys: async () => [...entries.keys()],
  }
}

let idbStore: ReturnType<typeof createStore> | null = null
// Created lazily: unit tests (happy-dom) have no indexedDB and never touch it.
const store = (): ReturnType<typeof createStore> => (idbStore ??= createStore('dp2-offline', 'reads'))

export const idbStorage: OfflineStorage = {
  get: (key) => get(key, store()),
  set: (key, value) => set(key, value, store()),
  delete: (key) => del(key, store()),
  keys: async () => (await keys(store())).filter((key): key is string => typeof key === 'string'),
}
