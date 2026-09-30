import { api } from '@/shared/api/client'
import { contentRoutes } from '@/modules/content/infrastructure/client/routes'
import type { SubjectListResponse } from '@/modules/content/infrastructure/interfaces/SubjectListResponse'
import type { TopicListResponse } from '@/modules/content/infrastructure/interfaces/TopicListResponse'

export const contentRequests = {
  listSubjects: () => api.get<SubjectListResponse>({ url: contentRoutes.subjects }),
  listTopics: () => api.get<TopicListResponse>({ url: contentRoutes.topics }),
}
