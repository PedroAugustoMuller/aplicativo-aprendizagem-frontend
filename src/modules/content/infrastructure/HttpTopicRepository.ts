import { contentRequests } from '@/modules/content/infrastructure/client/requests'
import type { Topic } from '@/modules/content/domain/Topic'
import type { TopicRepository } from '@/modules/content/domain/TopicRepository'
import type { TopicResponse } from '@/modules/content/infrastructure/interfaces/TopicListResponse'

const toDomain = (response: TopicResponse): Topic => ({
  id: response.id,
  name: response.name,
  description: response.description,
  position: response.position,
})

export const topicRepository: TopicRepository = {
  async list(): Promise<Topic[]> {
    const response = await contentRequests.listTopics()

    // Ordering is a display guarantee we own; do not depend on the server's order.
    return response.map(toDomain).sort((a, b) => a.position - b.position)
  },
}
