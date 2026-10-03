import { ref } from 'vue'
import { defineStore } from 'pinia'
import { questionRepository } from '@/modules/content/infrastructure/HttpQuestionRepository'
import { readThrough } from '@/shared/offline/readThrough'
import { ApiError } from '@/shared/api/error'
import type { Question, QuestionContent } from '@/modules/content/domain/Question'

/** One topic's bank at a time, like topicStore holds one subject's topics. */
export const useQuestionStore = defineStore('questions', () => {
  const topicId = ref<string | null>(null)
  const questions = ref<Question[]>([])
  const savedAt = ref<Date | null>(null)
  const loading = ref(false)
  const error = ref<ApiError | null>(null)
  // Only the latest load() may write results; an older, slower response loses.
  let latest = 0

  async function load(nextTopicId: string): Promise<void> {
    const request = ++latest

    if (topicId.value !== nextTopicId) {
      topicId.value = nextTopicId
      questions.value = []
      savedAt.value = null
    }

    loading.value = true
    error.value = null

    try {
      const snapshot = await readThrough(`content:questions:${nextTopicId}`, () =>
        questionRepository.listByTopic(nextTopicId),
      )

      if (request === latest) {
        questions.value = snapshot.value
        savedAt.value = snapshot.savedAt
      }
    } catch (failure: unknown) {
      if (request === latest) {
        error.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
        questions.value = []
        savedAt.value = null
      }
    } finally {
      if (request === latest) {
        loading.value = false
      }
    }
  }

  function find(id: string): Question | null {
    return questions.value.find((question) => question.id === id) ?? null
  }

  function currentTopic(): string {
    if (topicId.value === null) {
      throw new ApiError('system.unexpected_error')
    }

    return topicId.value
  }

  // Writes need a connection and let their ApiError reach the form that asked.
  async function create(id: string, content: QuestionContent): Promise<void> {
    const current = currentTopic()
    await questionRepository.create(current, id, content)
    await load(current)
  }

  async function update(id: string, version: number, content: QuestionContent): Promise<void> {
    const current = currentTopic()
    await questionRepository.update(id, version, content)
    await load(current)
  }

  async function setActive(id: string, active: boolean): Promise<void> {
    const current = currentTopic()
    await (active ? questionRepository.reactivate(id) : questionRepository.deactivate(id))
    await load(current)
  }

  function reset(): void {
    // Bumping the counter makes any in-flight load() discard its result.
    latest += 1
    topicId.value = null
    questions.value = []
    savedAt.value = null
    loading.value = false
    error.value = null
  }

  return { topicId, questions, savedAt, loading, error, load, find, create, update, setActive, reset }
})
