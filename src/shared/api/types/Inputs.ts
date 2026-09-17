export interface BaseInput {
  url: string
  urlParams?: Record<string, string>
  headers?: Record<string, string>
}

interface BodyInput {
  data?: unknown
}

export type GetInput = BaseInput & {
  queryParams?: Record<string, string | number | boolean | undefined>
}

export type PostInput = BaseInput & BodyInput
export type PutInput = BaseInput & BodyInput
export type PatchInput = BaseInput & BodyInput
export type DeleteInput = BaseInput
