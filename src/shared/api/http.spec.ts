import { describe, expect, it, vi } from 'vitest'
import { createHttpClient } from '@/shared/api/http'
import { envelopeErrorAdapter, envelopeResponseAdapter } from '@/shared/api/adapters'
import { ApiError } from '@/shared/api/error'
import type { Transport } from '@/shared/api/types/Transport'

const client = (transport: Transport) =>
  createHttpClient(transport, envelopeResponseAdapter, envelopeErrorAdapter)

describe('createHttpClient', () => {
  it('interpolates url params before calling the transport', async () => {
    const transport = vi.fn<Transport>().mockResolvedValue({ status: 200, ok: true, body: { data: 'ok' } })

    await client(transport).get<string>({ url: '/topics/:id', urlParams: { id: '42' } })

    expect(transport).toHaveBeenCalledWith(expect.objectContaining({ url: '/topics/42', method: 'GET' }))
  })

  it('returns the adapted payload', async () => {
    const transport = vi.fn<Transport>().mockResolvedValue({ status: 200, ok: true, body: { data: [{ id: '1' }] } })

    await expect(client(transport).get({ url: '/topics' })).resolves.toEqual([{ id: '1' }])
  })

  it('throws an ApiError when the response is not ok', async () => {
    const transport = vi.fn<Transport>().mockResolvedValue({
      status: 401,
      ok: false,
      body: { error: { code: 'auth.unauthenticated', params: {}, message: 'x', trace_id: 'T' } },
    })

    await expect(client(transport).get({ url: '/topics' })).rejects.toBeInstanceOf(ApiError)
    await expect(client(transport).get({ url: '/topics' })).rejects.toMatchObject({
      code: 'auth.unauthenticated',
    })
  })

  it('converts a thrown transport failure into an ApiError', async () => {
    const transport = vi.fn<Transport>().mockRejectedValue(new ApiError('api.network_unavailable'))

    await expect(client(transport).get({ url: '/topics' })).rejects.toMatchObject({
      code: 'api.network_unavailable',
    })
  })

  it('sends a body on post and put', async () => {
    const transport = vi.fn<Transport>().mockResolvedValue({ status: 200, ok: true, body: { data: null } })
    const http = client(transport)

    await http.post({ url: '/auth/login', data: { email: 'a@b.com' } })
    await http.put({ url: '/topics/:id', urlParams: { id: '1' }, data: { name: 'x' } })

    expect(transport).toHaveBeenNthCalledWith(1, expect.objectContaining({ method: 'POST', data: { email: 'a@b.com' } }))
    expect(transport).toHaveBeenNthCalledWith(2, expect.objectContaining({ method: 'PUT', url: '/topics/1' }))
  })
})
