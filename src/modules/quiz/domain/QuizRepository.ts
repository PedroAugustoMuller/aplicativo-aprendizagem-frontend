import type { AnswerOutcome, Attempt, PendingAnswer } from '@/modules/quiz/domain/Attempt'

export interface QuizRepository {
  /** Starting and downloading are the same call; the server may return an open attempt instead. */
  start(topicId: string, attemptId: string): Promise<Attempt>
  get(attemptId: string): Promise<Attempt>
  answer(answer: PendingAnswer): Promise<AnswerOutcome>
}
