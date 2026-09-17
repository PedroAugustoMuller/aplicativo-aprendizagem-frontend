import { ApiError } from '@/shared/api/error'
import type { Transport, TransportRequest, TransportResponse } from '@/shared/api/types/Transport'

export interface FetchTransportOptions {
  baseUrl: string
  getToken: () => string | null
  /**
   * Called on a 401 to a request that carried a token. The transport deliberately knows nothing about the router:
   * the composition root decides what "signed out" means.
   */
  onUnauthorized: () => void
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

const DEFAULT_TIMEOUT_MS = 15_000

export function createFetchTransport(options: FetchTransportOptions): Transport {
  const { baseUrl, getToken, onUnauthorized, timeoutMs = DEFAULT_TIMEOUT_MS } = options
  const doFetch = options.fetchImpl ?? globalThis.fetch.bind(globalThis)

  return async (request: TransportRequest): Promise<TransportResponse> => {
    const token = getToken()

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(request.data === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
      ...request.headers,
    }

    let response: Response
    let body: unknown
    try {
      response = await doFetch(baseUrl + buildPath(request), {
        method: request.method,
        headers,
        // Omitted entirely rather than set to `undefined`: RequestInit.body is an
        // optional DOM property, and exactOptionalPropertyTypes rejects an explicit
        // `undefined` value for it just as it would for our own types.
        ...(request.data === undefined ? {} : { body: JSON.stringify(request.data) }),
        signal: AbortSignal.timeout(timeoutMs),
      })
      // Read the body inside the same mapped region as the fetch itself: a
      // connection that drops mid-stream fails here, not at doFetch, and must
      // still degrade to a translatable network error rather than a raw TypeError.
      body = await readBody(response)
    } catch (cause) {
      throw toTransportError(cause)
    }

    // Only a request that carried a token can have an expired session. A 401 on
    // an anonymous request (a wrong password on the login POST) is an answer for
    // the caller, not a reason to sign anyone out.
    if (response.status === 401 && token !== null) {
      onUnauthorized()
    }

    return { status: response.status, ok: response.ok, body }
  }
}

function buildPath(request: TransportRequest): string {
  const entries = Object.entries(request.queryParams ?? {}).filter(
    (entry): entry is [string, string | number | boolean] => entry[1] !== undefined,
  )

  if (entries.length === 0) {
    return request.url
  }

  const query = new URLSearchParams(entries.map(([key, value]) => [key, String(value)]))

  return `${request.url}?${query.toString()}`
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text()

  if (text === '') {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function toTransportError(cause: unknown): ApiError {
  if (cause instanceof DOMException && (cause.name === 'TimeoutError' || cause.name === 'AbortError')) {
    return new ApiError('api.request_timeout')
  }

  return new ApiError('api.network_unavailable')
}
