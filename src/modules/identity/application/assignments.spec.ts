import { describe, expect, it } from 'vitest'
import { assignmentsDroppedBy, duplicatedTeacherIds, redundantTeacherIds, subjectsTaughtBy } from '@/modules/identity/domain/assignments'
import type { Classroom } from '@/modules/identity/domain/Classroom'

const CLASSROOM: Classroom = {
  id: 'c-1',
  name: '7º A',
  subjectIds: ['mat', 'port'],
  studentCount: 0,
  active: true,
  assignments: [{ teacherId: 'ana', subjectId: null }, { teacherId: 'carlos', subjectId: 'mat' }],
}

describe('classroom assignments', () => {
  it('gives a whole-class teacher every subject and a subject teacher only theirs', () => {
    expect(subjectsTaughtBy(CLASSROOM, 'ana')).toEqual(['mat', 'port'])
    expect(subjectsTaughtBy(CLASSROOM, 'carlos')).toEqual(['mat'])
    expect(subjectsTaughtBy(CLASSROOM, 'nobody')).toEqual([])
  })

  it('finds teachers assigned to the whole class and to a subject of it', () => {
    expect(redundantTeacherIds([
      { teacherId: 'ana', subjectId: null },
      { teacherId: 'ana', subjectId: 'mat' },
      { teacherId: 'carlos', subjectId: 'mat' },
    ])).toEqual(['ana'])
  })

  it('lists the assignments a new subject list would drop', () => {
    expect(assignmentsDroppedBy(CLASSROOM, ['port'])).toEqual([{ teacherId: 'carlos', subjectId: 'mat' }])
    expect(assignmentsDroppedBy(CLASSROOM, ['mat', 'port', 'hist'])).toEqual([])
  })
  it('finds teachers whose same assignment appears twice', () => {
    expect(duplicatedTeacherIds([
      { teacherId: 'ana', subjectId: 'mat' },
      { teacherId: 'ana', subjectId: 'mat' },
      { teacherId: 'ana', subjectId: 'port' },
      { teacherId: 'carlos', subjectId: null },
    ])).toEqual(['ana'])
  })
})
