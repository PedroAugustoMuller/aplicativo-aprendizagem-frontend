import type { ApiError } from '@/shared/api/error'

type Translate = (key: string, params?: Record<string, unknown>) => string
type Exists = (key: string) => boolean

/**
 * The only path from an ApiError to something a user reads.
 * The envelope's `message` field is never consulted.
 */
export function apiErrorMessage(error: ApiError, t: Translate, te: Exists): string {
  const key = `errors.${error.code}`

  if (te(key)) {
    return t(key, error.params)
  }

  if (error.code.startsWith('validation.')) {
    return t('errors.validation.invalid', error.params)
  }

  return t('errors.system.unexpected_error')
}
