import { ApiError, type FieldError } from '@/shared/api/error'
import type { ErrorAdapter, ResponseAdapter } from '@/shared/api/types/Adapters'

export const envelopeResponseAdapter: ResponseAdapter<unknown> = (response) => {
  const body = response.body

  if (isRecord(body) && 'data' in body) {
    return body.data
  }

  return body
}

export const envelopeErrorAdapter: ErrorAdapter = (failure) => {
  if (failure instanceof ApiError) {
    return failure
  }

  if (!isRecord(failure)) {
    return new ApiError('api.unexpected_response')
  }

  const status = typeof failure.status === 'number' ? failure.status : undefined
  const body = failure.body
  const envelope = isRecord(body) && isRecord(body.error) ? body.error : null

  if (envelope === null) {
    return new ApiError('api.unexpected_response', {}, status)
  }

  return new ApiError(
    typeof envelope.code === 'string' ? envelope.code : 'api.unexpected_response',
    isRecord(envelope.params) ? envelope.params : {},
    status,
    typeof envelope.trace_id === 'string' ? envelope.trace_id : undefined,
    readFields(isRecord(body) ? body.errors : undefined),
  )
}

function readFields(raw: unknown): Record<string, FieldError[]> | undefined {
  if (!isRecord(raw)) {
    return undefined
  }

  const fields: Record<string, FieldError[]> = {}

  for (const [field, entries] of Object.entries(raw)) {
    if (!Array.isArray(entries)) {
      continue
    }

    fields[field] = entries.filter(isRecord).map((entry) => ({
      code: typeof entry.code === 'string' ? entry.code : 'validation.invalid',
      params: isRecord(entry.params) ? entry.params : {},
    }))
  }

  return fields
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null
