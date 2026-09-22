import { api } from '@/shared/api/client'
import { contentRoutes } from '@/modules/content/infrastructure/client/routes'
import type { TopicListResponse } from '@/modules/content/infrastructure/interfaces/TopicListResponse'
import type { SubjectResponse } from '@/modules/content/infrastructure/interfaces/SubjectResponse'

export const contentRequests = {
  listSubjects: () => api.get<SubjectResponse[]>({ url: contentRoutes.subjects }),

  createSubject: (data: { id: string; name: string }) =>
    api.post<SubjectResponse>({ url: contentRoutes.subjects, data }),

  renameSubject: (id: string, data: { name: string }) =>
    api.patch<SubjectResponse>({ url: contentRoutes.subject, urlParams: { id }, data }),

  deactivateSubject: (id: string) =>
    api.post<SubjectResponse>({ url: contentRoutes.subjectDeactivate, urlParams: { id } }),

  listTopics: (subjectId: string) =>
    api.get<TopicListResponse>({ url: contentRoutes.subjectTopics, urlParams: { id: subjectId } }),
}
