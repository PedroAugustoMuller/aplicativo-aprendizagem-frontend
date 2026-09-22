import { describe, expect, it } from 'vitest'
import { navigationFor } from '@/shared/ui/navigation'

describe('navigationFor', () => {
  it('gives admins subjects, teachers and classrooms', () => {
    expect(navigationFor('admin').map((item) => item.to)).toEqual(['/classrooms', '/teachers', '/subjects'])
  })

  it('gives teachers only classrooms', () => {
    expect(navigationFor('teacher').map((item) => item.to)).toEqual(['/classrooms'])
  })

  it('gives students their classrooms', () => {
    expect(navigationFor('student').map((item) => item.to)).toEqual(['/my-classrooms'])
  })

  it('shows nothing while the role is unknown', () => {
    expect(navigationFor(null)).toEqual([])
  })
})
