import { ref } from 'vue'
import { defineStore } from 'pinia'
import { topicRepository } from '@/modules/content/infrastructure/HttpTopicRepository'
import { ApiError } from '@/shared/api/error'
import type { Topic } from '@/modules/content/domain/Topic'

export const useTopicStore = defineStore('topics', () => {
  const subjectId = ref<string | null>(null)
  const topics = ref<Topic[]>([])
  const loading = ref(false)
  const error = ref<ApiError | null>(null)
  // Only the latest load() may write results; an older, slower response loses.
  let latest = 0

  async function load(nextSubjectId: string): Promise<void> {
    const request = ++latest

    if (subjectId.value !== nextSubjectId) {
      subjectId.value = nextSubjectId
      topics.value = []
    }

    loading.value = true
    error.value = null

    try {
      const result = await topicRepository.listBySubject(nextSubjectId)

      if (request === latest) {
        topics.value = result
      }
    } catch (failure: unknown) {
      if (request === latest) {
        error.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
        topics.value = []
      }
    } finally {
      if (request === latest) {
        loading.value = false
      }
    }
  }

  function reset(): void {
    // Bumping the counter makes any in-flight load() discard its result.
    latest += 1
    subjectId.value = null
    topics.value = []
    loading.value = false
    error.value = null
  }

  return { subjectId, topics, loading, error, load, reset }
})
