import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFetchTransport } from '@/shared/api/transport'

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

describe('createFetchTransport', () => {
  let onUnauthorized: ReturnType<typeof vi.fn<() => void>>

  beforeEach(() => {
    onUnauthorized = vi.fn<() => void>()
  })

  const build = (fetchImpl: typeof fetch, token: string | null = 'tok') =>
    createFetchTransport({
      baseUrl: 'http://api.test/api/v1',
      getToken: () => token,
      onUnauthorized,
      fetchImpl,
    })

  it('prefixes the base url and parses the json body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { data: [{ id: '1' }] }))

    const response = await build(fetchImpl)({ method: 'GET', url: '/topics' })

    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('http://api.test/api/v1/topics')
    expect(response.ok).toBe(true)
    expect(response.body).toEqual({ data: [{ id: '1' }] })
  })

  it('attaches the bearer token when there is one', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, {}))

    await build(fetchImpl, 'secret-token')({ method: 'GET', url: '/topics' })

    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret-token')
  })

  it('omits the authorization header when there is no token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, {}))

    await build(fetchImpl, null)({ method: 'GET', url: '/topics' })

    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('appends defined query params and skips undefined ones', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, {}))

    await build(fetchImpl)({ method: 'GET', url: '/topics', queryParams: { page: 2, q: undefined } })

    expect(fetchImpl.mock.calls[0]?.[0]).toBe('http://api.test/api/v1/topics?page=2')
  })

  it('does not throw on a 4xx - it reports ok false', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(422, { error: { code: 'x' } }))

    const response = await build(fetchImpl)({ method: 'GET', url: '/topics' })

    expect(response.ok).toBe(false)
    expect(response.status).toBe(422)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('invokes onUnauthorized exactly once for a 401 on a request that carried a token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { error: { code: 'auth.unauthenticated' } }))

    await build(fetchImpl)({ method: 'GET', url: '/topics' })

    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('does not invoke onUnauthorized for a 401 on a request sent without a token', async () => {
    // A wrong password is a 401 on the login POST: an answer, not an expired session.
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { error: { code: 'identity.invalid_credentials' } }))

    const response = await build(fetchImpl, null)({ method: 'POST', url: '/auth/login', data: {} })

    expect(response.status).toBe(401)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('translates a network failure into a translatable ApiError', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(build(fetchImpl)({ method: 'GET', url: '/topics' })).rejects.toMatchObject({
      code: 'api.network_unavailable',
    })
  })

  it('translates a timeout into a translatable ApiError', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new DOMException('aborted', 'TimeoutError'))

    await expect(build(fetchImpl)({ method: 'GET', url: '/topics' })).rejects.toMatchObject({
      code: 'api.request_timeout',
    })
  })

  it('translates a body read failure into a translatable ApiError', async () => {
    const brokenResponse = {
      status: 200,
      ok: true,
      text: () => Promise.reject(new TypeError('network read failed')),
    } as unknown as Response
    const fetchImpl = vi.fn().mockResolvedValue(brokenResponse)

    await expect(build(fetchImpl)({ method: 'GET', url: '/topics' })).rejects.toMatchObject({
      code: 'api.network_unavailable',
    })
  })

  it('tolerates an empty body such as 204 No Content', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))

    const response = await build(fetchImpl)({ method: 'POST', url: '/auth/logout' })

    expect(response.status).toBe(204)
    expect(response.body).toBeNull()
  })
})
