import { ref } from 'vue'
import { defineStore } from 'pinia'
import { topicRepository } from '@/modules/content/infrastructure/HttpTopicRepository'
import { ApiError } from '@/shared/api/error'
import type { Topic } from '@/modules/content/domain/Topic'

export const useTopicStore = defineStore('topics', () => {
  const topics = ref<Topic[]>([])
  const loading = ref(false)
  const error = ref<ApiError | null>(null)

  async function load(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      topics.value = await topicRepository.list()
    } catch (failure: unknown) {
      error.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
      topics.value = []
    } finally {
      loading.value = false
    }
  }

  return { topics, loading, error, load }
})
