import type { ApiError } from '@/shared/api/error'

/**
 * A 403/404 means retrying cannot help (wrong role, or something that no
 * longer exists); only a network/timeout/5xx failure gets a retry button.
 * `status === undefined` covers the client-originated failures
 * (`api.network_unavailable`, `api.request_timeout`, `api.unexpected_response`)
 * that never carry an HTTP status.
 */
export function canRetry(error: ApiError | null): boolean {
  return error !== null && (error.status === undefined || error.status >= 500)
}
