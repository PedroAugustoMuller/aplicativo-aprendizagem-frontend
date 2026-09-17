import { api } from '@/shared/api/client'
import { contentRoutes } from '@/modules/content/infrastructure/client/routes'
import type { TopicListResponse } from '@/modules/content/infrastructure/interfaces/TopicListResponse'

export const contentRequests = {
  listTopics: () => api.get<TopicListResponse>({ url: contentRoutes.topics }),
}
