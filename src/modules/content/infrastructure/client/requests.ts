import { api } from '@/shared/api/client'
import { contentRoutes } from '@/modules/content/infrastructure/client/routes'
import type { SubjectListResponse, SubjectResponse } from '@/modules/content/infrastructure/interfaces/SubjectListResponse'
import type { TopicListResponse } from '@/modules/content/infrastructure/interfaces/TopicListResponse'

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
}
