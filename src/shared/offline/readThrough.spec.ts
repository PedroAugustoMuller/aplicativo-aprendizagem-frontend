import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearOfflineData, configureOffline, readThrough } from '@/shared/offline/readThrough'
import { createMemoryStorage, type OfflineStorage } from '@/shared/offline/storage'
import { ApiError } from '@/shared/api/error'

let storage: OfflineStorage
let userId: string | null

const offline = () => Promise.reject(new ApiError('api.network_unavailable'))

beforeEach(() => {
  storage = createMemoryStorage()
  userId = 'u-1'
  configureOffline({ userId: () => userId, storage })
})

afterEach(() => vi.useRealTimers())

describe('readThrough', () => {
  it('returns live data and keeps a copy for this user', async () => {
    await expect(readThrough('teachers', async () => ['Ana'])).resolves.toEqual({ value: ['Ana'], savedAt: null })
    expect(await storage.keys()).toEqual(['u-1:teachers'])
  })

  it('serves the saved copy, with its time, when the network is down', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-30T12:40:00.000Z'))
    await readThrough('teachers', async () => ['Ana'])
    vi.useRealTimers()

    const snapshot = await readThrough('teachers', offline)

    expect(snapshot.value).toEqual(['Ana'])
    expect(snapshot.savedAt?.toISOString()).toBe('2026-09-30T12:40:00.000Z')
  })

  it('serves the saved copy on a timeout too', async () => {
    await readThrough('teachers', async () => ['Ana'])

    const snapshot = await readThrough('teachers', () => Promise.reject(new ApiError('api.request_timeout')))

    expect(snapshot.value).toEqual(['Ana'])
  })

  it.each([
    ['auth.forbidden', 403],
    ['http.not_found', 404],
    ['system.unexpected_error', 500],
  ])('never hides a real answer (%s) behind saved data', async (code, status) => {
    await readThrough('teachers', async () => ['Ana'])

    await expect(readThrough('teachers', () => Promise.reject(new ApiError(code, {}, status))))
      .rejects.toMatchObject({ code })
  })

  it('rethrows the network failure when nothing was saved', async () => {
    await expect(readThrough('teachers', offline)).rejects.toMatchObject({ code: 'api.network_unavailable' })
  })

  it('keeps each user\'s copy apart', async () => {
    await readThrough('teachers', async () => ['Ana'])
    userId = 'u-2'

    await expect(readThrough('teachers', offline)).rejects.toMatchObject({ code: 'api.network_unavailable' })
  })

  it('neither saves nor reads without a user', async () => {
    userId = null

    await expect(readThrough('teachers', async () => ['Ana'])).resolves.toEqual({ value: ['Ana'], savedAt: null })
    expect(await storage.keys()).toEqual([])
  })

  it('still answers when saving the copy fails', async () => {
    storage.set = () => Promise.reject(new Error('quota exceeded'))

    await expect(readThrough('teachers', async () => ['Ana'])).resolves.toEqual({ value: ['Ana'], savedAt: null })
  })

  it('treats an unreadable saved entry as no copy', async () => {
    await storage.set('u-1:teachers', 'garbage')

    await expect(readThrough('teachers', offline)).rejects.toMatchObject({ code: 'api.network_unavailable' })
  })
})

describe('clearOfflineData', () => {
  it('deletes only that user\'s copies', async () => {
    await readThrough('a', async () => 1)
    userId = 'u-2'
    await readThrough('a', async () => 2)

    await clearOfflineData('u-1')

    expect(await storage.keys()).toEqual(['u-2:a'])
  })
})
