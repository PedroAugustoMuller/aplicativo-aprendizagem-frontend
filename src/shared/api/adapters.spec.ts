import { describe, expect, it } from 'vitest'
import { envelopeErrorAdapter, envelopeResponseAdapter } from '@/shared/api/adapters'
import { ApiError } from '@/shared/api/error'

describe('envelopeResponseAdapter', () => {
  it('unwraps the data envelope', () => {
    expect(envelopeResponseAdapter({ status: 200, ok: true, body: { data: [1, 2] } })).toEqual([1, 2])
  })

  it('returns null for an empty body', () => {
    expect(envelopeResponseAdapter({ status: 204, ok: true, body: null })).toBeNull()
  })
})

describe('envelopeErrorAdapter', () => {
  it('maps the error envelope onto ApiError', () => {
    const error = envelopeErrorAdapter({
      status: 422,
      ok: false,
      body: {
        error: {
          code: 'content.topic.name_already_taken',
          params: { name: 'Ligações Químicas' },
          message: 'Topic name already taken.',
          trace_id: 'TRACE123',
        },
      },
    })

    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('content.topic.name_already_taken')
    expect(error.params).toEqual({ name: 'Ligações Químicas' })
    expect(error.status).toBe(422)
    expect(error.traceId).toBe('TRACE123')
  })

  it('carries per-field validation codes', () => {
    const error = envelopeErrorAdapter({
      status: 422,
      ok: false,
      body: {
        error: { code: 'validation.failed', params: {}, message: 'Validation failed.', trace_id: 'T' },
        errors: { email: [{ code: 'validation.required', params: { attribute: 'email' } }] },
      },
    })

    expect(error.fieldCodes('email')).toEqual(['validation.required'])
    expect(error.fieldCodes('password')).toEqual([])
  })

  it('never surfaces the server message as the code', () => {
    const error = envelopeErrorAdapter({
      status: 500,
      ok: false,
      body: { error: { code: 'system.unexpected_error', params: {}, message: 'leaky detail', trace_id: 'T' } },
    })

    expect(error.code).toBe('system.unexpected_error')
    expect(JSON.stringify(error.params)).not.toContain('leaky detail')
    expect(error.message).not.toContain('leaky detail')
  })

  it('falls back to a known code when the body is not an envelope', () => {
    expect(envelopeErrorAdapter({ status: 502, ok: false, body: '<html>gateway</html>' }).code)
      .toBe('api.unexpected_response')
  })

  it('passes an existing ApiError through unchanged', () => {
    const original = new ApiError('api.network_unavailable')

    expect(envelopeErrorAdapter(original)).toBe(original)
  })
})
