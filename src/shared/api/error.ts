export interface FieldError {
  code: string
  params: Record<string, unknown>
}

/**
 * Carries a translation key, never text. The UI renders t(error.code, error.params).
 */
export class ApiError extends Error {
  // Written as explicit field declarations, not constructor parameter properties:
  // the project's `erasableSyntaxOnly` tsconfig flag rejects parameter-property
  // shorthand because it is not pure type erasure (it emits assignments).
  readonly code: string
  readonly params: Record<string, unknown>
  readonly status?: number | undefined
  readonly traceId?: string | undefined
  readonly fields?: Record<string, FieldError[]> | undefined

  constructor(
    code: string,
    params: Record<string, unknown> = {},
    status?: number,
    traceId?: string,
    fields?: Record<string, FieldError[]>,
  ) {
    super(code)
    this.name = 'ApiError'
    this.code = code
    this.params = params
    this.status = status
    this.traceId = traceId
    this.fields = fields
  }

  isUnauthorized(): boolean {
    return this.status === 401
  }

  fieldCodes(field: string): string[] {
    return (this.fields?.[field] ?? []).map((entry) => entry.code)
  }
}
