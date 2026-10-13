import type { RouteParamsGeneric } from 'vue-router'
import { OWN, type ProgressSource } from '@/modules/quiz/domain/Progress'

const param = (params: RouteParamsGeneric, name: string): string => {
  const value = params[name]

  return typeof value === 'string' ? value : ''
}

/** Staff routes carry the classroom, the subject and the student; every other progress route is the viewer's own. */
export function sourceFromParams(params: RouteParamsGeneric): ProgressSource {
  const classroomId = param(params, 'classroomId')
  const subjectId = param(params, 'subjectId')
  const studentId = param(params, 'studentId')

  return classroomId !== '' && subjectId !== '' && studentId !== '' ? { kind: 'student', classroomId, subjectId, studentId } : OWN
}

export interface ProgressLinks {
  readonly progress: string
  readonly wrong: string
  readonly attempt: (attemptId: string) => string
}

export function progressLinks(source: ProgressSource, subjectId: string, topicId: string): ProgressLinks {
  if (source.kind === 'own') {
    return {
      progress: `/subjects/${subjectId}/topics/${topicId}/progress`,
      wrong: `/subjects/${subjectId}/topics/${topicId}/review`,
      attempt: (attemptId) => `/quiz/${attemptId}/review`,
    }
  }

  const base = `/classrooms/${source.classroomId}/subjects/${source.subjectId}/students/${source.studentId}`

  return {
    progress: `${base}/topics/${topicId}/progress`,
    wrong: `${base}/topics/${topicId}/review`,
    attempt: (attemptId) => `${base}/quiz/${attemptId}/review`,
  }
}
