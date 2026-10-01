import { ref } from 'vue'
import { defineStore } from 'pinia'
import { topicRepository } from '@/modules/content/infrastructure/HttpTopicRepository'
import { readThrough } from '@/shared/offline/readThrough'
import { ApiError } from '@/shared/api/error'
import type { Topic } from '@/modules/content/domain/Topic'

export const useTopicStore = defineStore('topics', () => {
  const subjectId = ref<string | null>(null)
  const topics = ref<Topic[]>([])
  const savedAt = ref<Date | null>(null)
  const loading = ref(false)
  const error = ref<ApiError | null>(null)
  // Only the latest load() may write results; an older, slower response loses.
  let latest = 0

  async function load(nextSubjectId: string): Promise<void> {
    const request = ++latest

    if (subjectId.value !== nextSubjectId) {
      subjectId.value = nextSubjectId
      topics.value = []
      savedAt.value = null
    }

    loading.value = true
    error.value = null

    try {
      const snapshot = await readThrough(`content:topics:${nextSubjectId}`, () =>
        topicRepository.listBySubject(nextSubjectId),
      )

      if (request === latest) {
        topics.value = snapshot.value
        savedAt.value = snapshot.savedAt
      }
    } catch (failure: unknown) {
      if (request === latest) {
        error.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
        topics.value = []
        savedAt.value = null
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
    savedAt.value = null
    loading.value = false
    error.value = null
  }

  return { subjectId, topics, savedAt, loading, error, load, reset }
})
