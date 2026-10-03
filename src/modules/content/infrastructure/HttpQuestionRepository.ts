import { contentRequests } from '@/modules/content/infrastructure/client/requests'
import type { Question, QuestionContent } from '@/modules/content/domain/Question'
import type { QuestionRepository } from '@/modules/content/domain/QuestionRepository'
import type { QuestionContentBody, QuestionResponse } from '@/modules/content/infrastructure/interfaces/QuestionResponse'

const toDomain = (response: QuestionResponse): Question => ({
  id: response.id,
  topicId: response.topic_id,
  type: response.type,
  statement: response.statement,
  explanation: response.explanation,
  active: response.active,
  version: response.version,
  options: [...response.options]
    .sort((a, b) => a.position - b.position)
    .map((option) => ({ id: option.id, text: option.text, correct: option.correct })),
})

function contentBody(content: QuestionContent): QuestionContentBody {
  if (content.type === 'true_false') {
    return { statement: content.statement, explanation: content.explanation, correct: content.answer }
  }

  return {
    statement: content.statement,
    explanation: content.explanation,
    // A new option has no id yet: sending none is how the server knows to create one.
    options: content.options.map((option) =>
      option.id === null
        ? { text: option.text, correct: option.correct }
        : { id: option.id, text: option.text, correct: option.correct },
    ),
  }
}

export const questionRepository: QuestionRepository = {
  async listByTopic(topicId) {
    return (await contentRequests.listQuestions(topicId)).map(toDomain)
  },

  async create(topicId, id, content) {
    return toDomain(await contentRequests.createQuestion(topicId, { id, type: content.type, ...contentBody(content) }))
  },

  async update(id, version, content) {
    return toDomain(await contentRequests.updateQuestion(id, { version, ...contentBody(content) }))
  },

  async deactivate(id) {
    return toDomain(await contentRequests.deactivateQuestion(id))
  },

  async reactivate(id) {
    return toDomain(await contentRequests.reactivateQuestion(id))
  },
}
