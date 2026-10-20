export interface TransportRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  url: string
  queryParams?: Record<string, string | number | boolean | undefined> | undefined
  data?: unknown
  headers?: Record<string, string> | undefined
  /** Overrides the transport's default for this one request. */
  timeoutMs?: number | undefined
}

export interface TransportResponse {
  status: number
  ok: boolean
  body: unknown
}

export type Transport = (request: TransportRequest) => Promise<TransportResponse>
