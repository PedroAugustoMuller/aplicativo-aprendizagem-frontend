const chains = new Map<string, Promise<unknown>>()

/**
 * One holder at a time per name: across tabs with the Web Locks API, else within
 * this tab (older browsers, unit tests).
 */
export async function withLock<T>(name: string, work: () => Promise<T>): Promise<T> {
  // Missing in older browsers, null in some test DOMs.
  const locks: LockManager | null | undefined = globalThis.navigator?.locks

  if (locks !== undefined && locks !== null) {
    return locks.request(name, work)
  }

  const run = (chains.get(name) ?? Promise.resolve()).catch(() => undefined).then(work)
  chains.set(name, run.catch(() => undefined))

  return run
}
