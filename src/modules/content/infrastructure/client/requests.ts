import { api } from '@/shared/api/client'
import { contentRoutes } from '@/modules/content/infrastructure/client/routes'
import type { SubjectListResponse, SubjectResponse } from '@/modules/content/infrastructure/interfaces/SubjectListResponse'
import type { TopicListResponse, TopicResponse } from '@/modules/content/infrastructure/interfaces/TopicListResponse'
import type {
  QuestionCreateBody,
  QuestionListResponse,
  QuestionResponse,
  QuestionUpdateBody,
} from '@/modules/content/infrastructure/interfaces/QuestionResponse'

export const contentRequests = {
  listSubjects: () => api.get<SubjectListResponse>({ url: contentRoutes.subjects }),
  listTopics: (subjectId: string) =>
    api.get<TopicListResponse>({ url: contentRoutes.subjectTopics, urlParams: { subjectId } }),

  createSubject: (data: { id: string; name: string }) =>
    api.post<SubjectResponse>({ url: contentRoutes.subjects, data }),
  renameSubject: (subjectId: string, name: string) =>
    api.patch<SubjectResponse>({ url: contentRoutes.subject, urlParams: { subjectId }, data: { name } }),
  deactivateSubject: (subjectId: string) =>
    api.post<SubjectResponse>({ url: contentRoutes.subjectDeactivate, urlParams: { subjectId } }),

  createTopic: (subjectId: string, data: { id: string; name: string; description: string }) =>
    api.post<TopicResponse>({ url: contentRoutes.subjectTopics, urlParams: { subjectId }, data }),
  updateTopic: (topicId: string, data: { name?: string; description?: string }) =>
    api.patch<TopicResponse>({ url: contentRoutes.topic, urlParams: { topicId }, data }),
  deactivateTopic: (topicId: string) =>
    api.post<TopicResponse>({ url: contentRoutes.topicDeactivate, urlParams: { topicId } }),
  reactivateTopic: (topicId: string) =>
    api.post<TopicResponse>({ url: contentRoutes.topicReactivate, urlParams: { topicId } }),
  reorderTopics: (subjectId: string, ids: string[]) =>
    api.put<TopicListResponse>({ url: contentRoutes.subjectTopicOrder, urlParams: { subjectId }, data: { ids } }),

  listQuestions: (topicId: string) =>
    api.get<QuestionListResponse>({ url: contentRoutes.topicQuestions, urlParams: { topicId } }),
  createQuestion: (topicId: string, data: QuestionCreateBody) =>
    api.post<QuestionResponse>({ url: contentRoutes.topicQuestions, urlParams: { topicId }, data }),
  updateQuestion: (questionId: string, data: QuestionUpdateBody) =>
    api.put<QuestionResponse>({ url: contentRoutes.question, urlParams: { questionId }, data }),
  deactivateQuestion: (questionId: string) =>
    api.post<QuestionResponse>({ url: contentRoutes.questionDeactivate, urlParams: { questionId } }),
  reactivateQuestion: (questionId: string) =>
    api.post<QuestionResponse>({ url: contentRoutes.questionReactivate, urlParams: { questionId } }),
}
