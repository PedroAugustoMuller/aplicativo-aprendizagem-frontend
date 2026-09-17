import { describe, expect, it } from 'vitest'
import { interpolateUrl } from '@/shared/api/url'

describe('interpolateUrl', () => {
  it('substitutes named segments', () => {
    expect(interpolateUrl('/topics/:id/questions/:questionId', { id: '7', questionId: '9' }))
      .toBe('/topics/7/questions/9')
  })

  it('returns the url untouched when there are no params', () => {
    expect(interpolateUrl('/topics')).toBe('/topics')
  })

  it('encodes values so an id cannot inject a path segment', () => {
    expect(interpolateUrl('/topics/:id', { id: 'a/../b' })).toBe('/topics/a%2F..%2Fb')
  })

  it('does not let a param name corrupt a longer param name that shares its prefix', () => {
    expect(interpolateUrl('/a/:id/:idExtra', { id: '7', idExtra: '9' })).toBe('/a/7/9')
  })
})
