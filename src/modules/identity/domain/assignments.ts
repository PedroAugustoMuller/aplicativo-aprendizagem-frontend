import type { Classroom, TeacherAssignment } from '@/modules/identity/domain/Classroom'

/** The classroom's subjects this teacher teaches: all of them for a whole-class assignment. */
export function subjectsTaughtBy(classroom: Classroom, teacherId: string): readonly string[] {
  const mine = classroom.assignments.filter((assignment) => assignment.teacherId === teacherId)

  if (mine.some((assignment) => assignment.subjectId === null)) {
    return classroom.subjectIds
  }

  return classroom.subjectIds.filter((subjectId) => mine.some((assignment) => assignment.subjectId === subjectId))
}

/** Teachers assigned to the whole class and to a subject of it: the backend rejects that. */
export function redundantTeacherIds(assignments: readonly TeacherAssignment[]): readonly string[] {
  const whole = new Set(assignments.filter((a) => a.subjectId === null).map((a) => a.teacherId))

  return [...new Set(assignments.filter((a) => a.subjectId !== null && whole.has(a.teacherId)).map((a) => a.teacherId))]
}

/** The subject assignments that leave with subjects missing from the new list. */
export function assignmentsDroppedBy(classroom: Classroom, nextSubjectIds: readonly string[]): readonly TeacherAssignment[] {
  return classroom.assignments.filter((a) => a.subjectId !== null && !nextSubjectIds.includes(a.subjectId))
}

/** Teachers with the same assignment listed twice: the backend rejects the list without naming a field. */
export function duplicatedTeacherIds(assignments: readonly TeacherAssignment[]): readonly string[] {
  const seen = new Set<string>()
  const duplicated = new Set<string>()

  for (const a of assignments) {
    const key = `${a.teacherId}|${a.subjectId ?? '*'}`

    if (seen.has(key)) {
      duplicated.add(a.teacherId)
    }

    seen.add(key)
  }

  return [...duplicated]
}
