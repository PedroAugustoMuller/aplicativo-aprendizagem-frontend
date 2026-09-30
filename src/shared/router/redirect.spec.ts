import { describe, expect, it } from 'vitest'
import { safeRedirect } from '@/shared/router/redirect'

describe('safeRedirect', () => {
  it.each(['/subjects', '/subjects/s-1/topics', '/subjects?tab=2', '/loginfo'])('keeps the in-app path %s', (path) => {
    expect(safeRedirect(path)).toBe(path)
  })

  it.each([
    ['another origin', '//evil.com'],
    ['a backslash origin', '/\\evil.com'],
    ['an absolute URL', 'https://evil.com'],
    ['a relative path', 'subjects'],
    ['the login page', '/login'],
    ['the login page with a query', '/login?redirect=/subjects'],
    ['the change page', '/change-password'],
    ['the change page with a query', '/change-password?redirect=/subjects'],
    ['under the change page', '/change-password/'],
    ['the change page with a hash', '/change-password#x'],
    ['an empty string', ''],
  ])('rejects %s', (_label, value) => {
    expect(safeRedirect(value)).toBeNull()
  })

  it.each([[undefined], [null], [['/subjects', '/x']], [42]])('rejects the non-string %j', (value) => {
    expect(safeRedirect(value)).toBeNull()
  })
})
