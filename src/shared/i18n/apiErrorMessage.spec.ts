import { describe, expect, it } from 'vitest'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { ApiError } from '@/shared/api/error'

const known = new Set([
  'errors.identity.invalid_credentials',
  'errors.system.unexpected_error',
  'errors.validation.invalid',
  'errors.validation.required',
])

const te = (key: string): boolean => known.has(key)
const t = (key: string, params?: Record<string, unknown>): string =>
  params && Object.keys(params).length > 0 ? `${key}:${JSON.stringify(params)}` : key

describe('apiErrorMessage', () => {
  it('translates a known code with its params', () => {
    const message = apiErrorMessage(new ApiError('identity.invalid_credentials'), t, te)

    expect(message).toBe('errors.identity.invalid_credentials')
  })

  it('falls back to the generic validation message for an unmapped rule', () => {
    const message = apiErrorMessage(new ApiError('validation.uuid', { attribute: 'id' }), t, te)

    expect(message).toContain('errors.validation.invalid')
  })

  it('falls back to the system message for a code the frontend has never seen', () => {
    const message = apiErrorMessage(new ApiError('quiz.attempt.already_submitted'), t, te)

    expect(message).toBe('errors.system.unexpected_error')
  })

  it('never renders the server message field', () => {
    const error = new ApiError('quiz.unknown', {}, 500, 'TRACE')

    expect(apiErrorMessage(error, t, te)).not.toContain('TRACE')
  })
})
