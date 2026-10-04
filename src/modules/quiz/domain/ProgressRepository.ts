import type { Attempt } from '@/modules/quiz/domain/Attempt'
import type { ProgressSource, StudentProgress, TopicHistory, TopicProgress, WrongQuestion } from '@/modules/quiz/domain/Progress'

export interface ProgressRepository {
  /** Only topics with answers; the others are iron at 0. */
  subjectProgress(subjectId: string): Promise<TopicProgress[]>
  topicHistory(source: ProgressSource, topicId: string): Promise<TopicHistory>
  wrongQuestions(source: ProgressSource, topicId: string): Promise<WrongQuestion[]>
  attempt(source: ProgressSource, attemptId: string): Promise<Attempt>
  classroomProgress(classroomId: string): Promise<StudentProgress[]>
}
