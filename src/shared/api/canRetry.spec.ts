import { describe, expect, it } from 'vitest'
import { canRetry } from '@/shared/api/canRetry'
import { ApiError } from '@/shared/api/error'

describe('canRetry', () => {
  it('is false when there is no error', () => {
    expect(canRetry(null)).toBe(false)
  })

  it('is false for a 403 (wrong role - retrying cannot help)', () => {
    expect(canRetry(new ApiError('auth.forbidden', {}, 403))).toBe(false)
  })

  it('is false for a 404 (the resource is gone - retrying cannot help)', () => {
    expect(canRetry(new ApiError('identity.classroom_not_found', {}, 404))).toBe(false)
  })

  it('is true for a 5xx (transient server failure)', () => {
    expect(canRetry(new ApiError('system.unexpected_error', {}, 500))).toBe(true)
  })

  it('is true when the error carries no status (a client-originated failure)', () => {
    expect(canRetry(new ApiError('api.network_unavailable'))).toBe(true)
  })
})
