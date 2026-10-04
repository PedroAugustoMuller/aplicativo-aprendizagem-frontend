import { api } from '@/shared/api/client'
import { quizRoutes } from '@/modules/quiz/infrastructure/client/routes'
import type { AnswerBody, AnswerResponse, AttemptResponse } from '@/modules/quiz/infrastructure/interfaces/AttemptResponse'
import type { ClassroomProgressResponse, TopicHistoryResponse, TopicProgressResponse, WrongQuestionResponse } from '@/modules/quiz/infrastructure/interfaces/ProgressResponse'

export const quizRequests = {
  start: (topicId: string, data: { id: string }) =>
    api.post<AttemptResponse>({ url: quizRoutes.topicAttempts, urlParams: { topicId }, data }),
  get: (attemptId: string) => api.get<AttemptResponse>({ url: quizRoutes.attempt, urlParams: { attemptId } }),
  answer: (attemptId: string, data: AnswerBody) =>
    api.post<AnswerResponse>({ url: quizRoutes.attemptAnswers, urlParams: { attemptId }, data }),
  subjectProgress: (subjectId: string) => api.get<TopicProgressResponse[]>({ url: quizRoutes.subjectProgress, urlParams: { subjectId } }),
  topicHistory: (topicId: string) => api.get<TopicHistoryResponse>({ url: quizRoutes.topicHistory, urlParams: { topicId } }),
  wrongQuestions: (topicId: string) => api.get<WrongQuestionResponse[]>({ url: quizRoutes.wrongQuestions, urlParams: { topicId } }),
  classroomProgress: (classroomId: string) =>
    api.get<ClassroomProgressResponse>({ url: quizRoutes.classroomProgress, urlParams: { classroomId } }),
  studentTopicHistory: (classroomId: string, studentId: string, topicId: string) =>
    api.get<TopicHistoryResponse>({ url: quizRoutes.studentTopicHistory, urlParams: { classroomId, studentId, topicId } }),
  studentWrongQuestions: (classroomId: string, studentId: string, topicId: string) =>
    api.get<WrongQuestionResponse[]>({ url: quizRoutes.studentWrongQuestions, urlParams: { classroomId, studentId, topicId } }),
  studentAttempt: (classroomId: string, studentId: string, attemptId: string) =>
    api.get<AttemptResponse>({ url: quizRoutes.studentAttempt, urlParams: { classroomId, studentId, attemptId } }),
}
