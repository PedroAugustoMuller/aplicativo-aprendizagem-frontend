/**
 * Client-generated id for create requests. Generate it when a form OPENS and reuse it
 * on every resubmit: the backend returns the original result for a repeated id, which
 * is what makes a double tap or a retry after a timeout safe.
 */
export const newId = (): string => globalThis.crypto.randomUUID()
