import { createFetchTransport } from '@/shared/api/transport'
import { createHttpClient, type HttpClient } from '@/shared/api/http'
import { envelopeErrorAdapter, envelopeResponseAdapter } from '@/shared/api/adapters'

type SessionHooks = {
  getToken: () => string | null
  onUnauthorized: () => void
}

// Filled in by main.ts. Kept behind functions so this module never imports a store,
// which would create a cycle and put routing inside the HTTP layer.
let hooks: SessionHooks = { getToken: () => null, onUnauthorized: () => {} }

export const configureApiSession = (next: SessionHooks): void => {
  hooks = next
}

export const api: HttpClient = createHttpClient(
  createFetchTransport({
    baseUrl: import.meta.env.VITE_API_URL,
    getToken: () => hooks.getToken(),
    onUnauthorized: () => hooks.onUnauthorized(),
  }),
  envelopeResponseAdapter,
  envelopeErrorAdapter,
)
