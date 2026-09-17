import { describe, expect, it } from 'vitest'
import { resolveThemeName } from '@/shared/theme/useAppTheme'

describe('resolveThemeName', () => {
  it('follows the system preference in system mode', () => {
    expect(resolveThemeName('system', true)).toBe('dark')
    expect(resolveThemeName('system', false)).toBe('light')
  })

  it('lets an explicit choice win over the system preference', () => {
    expect(resolveThemeName('light', true)).toBe('light')
    expect(resolveThemeName('dark', false)).toBe('dark')
  })
})
