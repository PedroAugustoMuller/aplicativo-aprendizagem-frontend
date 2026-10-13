import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useClassroomStore } from '@/modules/identity/application/classroomStore'
import { useSessionStore } from '@/modules/identity/application/sessionStore'
import { useTeacherStore } from '@/modules/identity/application/teacherStore'
import { subjectsTaughtBy } from '@/modules/identity/domain/assignments'
import type { Classroom } from '@/modules/identity/domain/Classroom'

/**
 * "Bruno (Turma toda), Clara (Química)" for the admin, who may list teachers; a teacher
 * cannot (admin-only endpoint), so they get their own scope and "and N more".
 */
export function useTeacherLine(): (classroom: Classroom) => string {
  const { t } = useI18n()
  const classrooms = useClassroomStore()
  const teachers = useTeacherStore()
  const session = useSessionStore()
  const isAdmin = computed(() => session.knownUser?.role === 'admin')

  const scopeOf = (subjectId: string | null): string =>
    subjectId === null ? t('classrooms.wholeClass') : (classrooms.subjectName(subjectId) ?? '…')

  return (classroom: Classroom): string => {
    if (classroom.assignments.length === 0) {
      return t('classrooms.noTeachers')
    }

    if (isAdmin.value) {
      return classroom.assignments
        .map((a) => t('classrooms.teacherScope', {
          name: teachers.teachers.find((teacher) => teacher.id === a.teacherId)?.name ?? '…',
          scope: scopeOf(a.subjectId),
        }))
        .join(', ')
    }

    const me = session.knownUser?.userId ?? ''
    const mine = classroom.assignments.some((a) => a.teacherId === me && a.subjectId === null)
      ? t('classrooms.wholeClass')
      : subjectsTaughtBy(classroom, me).map((id) => classrooms.subjectName(id) ?? '…').join(', ')
    const others = new Set(classroom.assignments.filter((a) => a.teacherId !== me).map((a) => a.teacherId)).size

    return others === 0 ? t('classrooms.youScope', { scope: mine }) : t('classrooms.youScopeAndOthers', { scope: mine, count: others })
  }
}
