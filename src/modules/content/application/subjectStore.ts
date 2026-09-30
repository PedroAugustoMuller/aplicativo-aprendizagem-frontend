import { ref } from 'vue'
import { defineStore } from 'pinia'
import { subjectRepository } from '@/modules/content/infrastructure/HttpSubjectRepository'
import { ApiError } from '@/shared/api/error'
import type { Subject } from '@/modules/content/domain/Subject'

export const useSubjectStore = defineStore('subjects', () => {
  const subjects = ref<Subject[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref<ApiError | null>(null)
  let inFlight: Promise<void> | null = null

  function load(): Promise<void> {
    // The subjects page and a topics page's title can both ask at once.
    if (inFlight !== null) {
      return inFlight
    }

    loading.value = true
    error.value = null

    inFlight = (async (): Promise<void> => {
      try {
        subjects.value = await subjectRepository.list()
        loaded.value = true
      } catch (failure: unknown) {
        error.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
        subjects.value = []
      } finally {
        loading.value = false
        inFlight = null
      }
    })()

    return inFlight
  }

  async function ensureLoaded(): Promise<void> {
    if (!loaded.value) {
      await load()
    }
  }

  function nameOf(id: string): string | null {
    return subjects.value.find((subject) => subject.id === id)?.name ?? null
  }

  return { subjects, loading, error, load, ensureLoaded, nameOf }
})
