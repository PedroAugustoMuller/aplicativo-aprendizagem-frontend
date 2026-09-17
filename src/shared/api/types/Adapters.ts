import type { ApiError } from '@/shared/api/error'
import type { TransportResponse } from '@/shared/api/types/Transport'

export type ResponseAdapter<T> = (response: TransportResponse) => T
export type ErrorAdapter = (failure: unknown) => ApiError
