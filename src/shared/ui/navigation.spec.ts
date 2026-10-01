import { describe, expect, it } from 'vitest'
import { navItemsFor } from '@/shared/ui/navigation'

const keys = (role: string | null) => navItemsFor(role).map((item) => item.key)

describe('navItemsFor', () => {
  it('gives an admin every area', () => {
    expect(keys('admin')).toEqual(['subjects', 'classrooms', 'teachers'])
  })

  it('gives a teacher subjects and classes', () => {
    expect(keys('teacher')).toEqual(['subjects', 'classrooms'])
  })

  it('gives a student subjects only', () => {
    expect(keys('student')).toEqual(['subjects'])
  })

  it('shows only what everyone may see while the user is unknown', () => {
    expect(keys(null)).toEqual(['subjects'])
  })
})
