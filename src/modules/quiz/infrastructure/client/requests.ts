import { api } from '@/shared/api/client'
import { quizRoutes } from '@/modules/quiz/infrastructure/client/routes'
import type { AnswerBody, AnswerResponse, AttemptResponse } from '@/modules/quiz/infrastructure/interfaces/AttemptResponse'

export const quizRequests = {
  start: (topicId: string, data: { id: string }) =>
    api.post<AttemptResponse>({ url: quizRoutes.topicAttempts, urlParams: { topicId }, data }),
  get: (attemptId: string) => api.get<AttemptResponse>({ url: quizRoutes.attempt, urlParams: { attemptId } }),
  answer: (attemptId: string, data: AnswerBody) =>
    api.post<AnswerResponse>({ url: quizRoutes.attemptAnswers, urlParams: { attemptId }, data }),
}
