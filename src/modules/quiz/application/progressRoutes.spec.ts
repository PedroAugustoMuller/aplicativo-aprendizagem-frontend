import { describe, expect, it } from 'vitest'
import { progressLinks, sourceFromParams } from '@/modules/quiz/application/progressRoutes'

describe('progress routes', () => {
  it('reads a staff source from classroom and student params, else the own one', () => {
    expect(sourceFromParams({ classroomId: 'c-1', studentId: 'u-9', topicId: 't-1' })).toEqual({ kind: 'student', classroomId: 'c-1', studentId: 'u-9' })
    expect(sourceFromParams({ subjectId: 's-1', topicId: 't-1' })).toEqual({ kind: 'own' })
  })

  it('builds the student and the staff links', () => {
    const own = progressLinks({ kind: 'own' }, 's-1', 't-1')
    const staff = progressLinks({ kind: 'student', classroomId: 'c-1', studentId: 'u-9' }, 's-1', 't-1')

    expect([own.progress, own.wrong, own.attempt('a-1')]).toEqual(['/subjects/s-1/topics/t-1/progress', '/subjects/s-1/topics/t-1/review', '/quiz/a-1/review'])
    expect([staff.progress, staff.wrong, staff.attempt('a-1')]).toEqual([
      '/classrooms/c-1/students/u-9/topics/t-1/progress', '/classrooms/c-1/students/u-9/topics/t-1/review', '/classrooms/c-1/students/u-9/quiz/a-1/review',
    ])
  })
})
