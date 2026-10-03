import { contentRequests } from '@/modules/content/infrastructure/client/requests'
import type { Topic } from '@/modules/content/domain/Topic'
import type { TopicRepository } from '@/modules/content/domain/TopicRepository'
import type { TopicResponse } from '@/modules/content/infrastructure/interfaces/TopicListResponse'

const toDomain = (response: TopicResponse): Topic => ({
  id: response.id,
  name: response.name,
  description: response.description,
  position: response.position,
  active: response.active,
  questionCount: response.active_question_count ?? null,
})

// Ordering is a display guarantee we own; do not depend on the server's order.
const byPosition = (topics: Topic[]): Topic[] => topics.sort((a, b) => a.position - b.position)

export const topicRepository: TopicRepository = {
  async listBySubject(subjectId) {
    return byPosition((await contentRequests.listTopics(subjectId)).map(toDomain))
  },

  async create(subjectId, id, input) {
    return toDomain(await contentRequests.createTopic(subjectId, { id, name: input.name, description: input.description }))
  },

  async update(id, patch) {
    // Only the keys that were sent: an undefined key would still be a field to the server.
    const body = {
      ...(patch.name === undefined ? {} : { name: patch.name }),
      ...(patch.description === undefined ? {} : { description: patch.description }),
    }

    return toDomain(await contentRequests.updateTopic(id, body))
  },

  async deactivate(id) {
    return toDomain(await contentRequests.deactivateTopic(id))
  },

  async reactivate(id) {
    return toDomain(await contentRequests.reactivateTopic(id))
  },

  async reorder(subjectId, ids) {
    return byPosition((await contentRequests.reorderTopics(subjectId, [...ids])).map(toDomain))
  },
}
