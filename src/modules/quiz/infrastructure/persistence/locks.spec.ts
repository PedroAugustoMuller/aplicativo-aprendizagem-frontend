import { describe, expect, it } from 'vitest'
import { withLock } from '@/modules/quiz/infrastructure/persistence/locks'

describe('withLock', () => {
  it('runs holders of one name one after the other, even after a failure', async () => {
    const order: string[] = []
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })

    const first = withLock('n', async () => {
      order.push('first:start')
      await gate
      order.push('first:end')
      throw new Error('boom')
    })
    const second = withLock('n', async () => {
      order.push('second')

      return 2
    })

    release()
    await expect(first).rejects.toThrow('boom')
    await expect(second).resolves.toBe(2)
    expect(order).toEqual(['first:start', 'first:end', 'second'])
  })

  it('does not hold up a different name', async () => {
    let release: () => void = () => undefined
    const blocked = withLock('a', () => new Promise<void>((resolve) => {
      release = resolve
    }))

    await expect(withLock('b', async () => 'free')).resolves.toBe('free')
    release()
    await blocked
  })
})
