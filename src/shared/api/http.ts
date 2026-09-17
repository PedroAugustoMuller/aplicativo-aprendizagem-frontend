import { interpolateUrl } from '@/shared/api/url'
import type { ErrorAdapter, ResponseAdapter } from '@/shared/api/types/Adapters'
import type { Transport, TransportRequest } from '@/shared/api/types/Transport'
import type {
  DeleteInput,
  GetInput,
  PatchInput,
  PostInput,
  PutInput,
} from '@/shared/api/types/Inputs'

export interface HttpClient {
  get<T>(input: GetInput): Promise<T>
  post<T>(input: PostInput): Promise<T>
  put<T>(input: PutInput): Promise<T>
  patch<T>(input: PatchInput): Promise<T>
  delete<T>(input: DeleteInput): Promise<T>
}

async function request<T>(
  transport: Transport,
  config: TransportRequest,
  responseAdapter: ResponseAdapter<unknown>,
  errorAdapter: ErrorAdapter,
): Promise<T> {
  let response

  try {
    response = await transport(config)
  } catch (failure: unknown) {
    throw errorAdapter(failure)
  }

  if (!response.ok) {
    throw errorAdapter(response)
  }

  return responseAdapter(response) as T
}

export function createHttpClient(
  transport: Transport,
  responseAdapter: ResponseAdapter<unknown>,
  errorAdapter: ErrorAdapter,
): HttpClient {
  const send = <T>(config: TransportRequest): Promise<T> =>
    request<T>(transport, config, responseAdapter, errorAdapter)

  return {
    get: <T>({ url, urlParams, queryParams, headers }: GetInput) =>
      send<T>({ method: 'GET', url: interpolateUrl(url, urlParams), queryParams, headers }),

    post: <T>({ url, urlParams, data, headers }: PostInput) =>
      send<T>({ method: 'POST', url: interpolateUrl(url, urlParams), data, headers }),

    put: <T>({ url, urlParams, data, headers }: PutInput) =>
      send<T>({ method: 'PUT', url: interpolateUrl(url, urlParams), data, headers }),

    patch: <T>({ url, urlParams, data, headers }: PatchInput) =>
      send<T>({ method: 'PATCH', url: interpolateUrl(url, urlParams), data, headers }),

    delete: <T>({ url, urlParams, headers }: DeleteInput) =>
      send<T>({ method: 'DELETE', url: interpolateUrl(url, urlParams), headers }),
  }
}
