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
  // Bumped by reset(): a load that started before it must not write afterwards.
  let generation = 0

  function load(): Promise<void> {
    // The subjects page and a topics page's title can both ask at once.
    if (inFlight !== null) {
      return inFlight
    }

    loading.value = true
    error.value = null
    const started = generation

    inFlight = (async (): Promise<void> => {
      try {
        const result = await subjectRepository.list()

        if (started === generation) {
          subjects.value = result
          loaded.value = true
        }
      } catch (failure: unknown) {
        if (started === generation) {
          error.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
          subjects.value = []
          loaded.value = false
        }
      } finally {
        if (started === generation) {
          loading.value = false
          inFlight = null
        }
      }
    })()

    return inFlight
  }

  async function ensureLoaded(): Promise<void> {
    if (!loaded.value) {
      await load()
    }
  }

  function reset(): void {
    generation += 1
    inFlight = null
    loading.value = false
    subjects.value = []
    loaded.value = false
    error.value = null
  }

  function nameOf(id: string): string | null {
    return subjects.value.find((subject) => subject.id === id)?.name ?? null
  }

  return { subjects, loading, error, load, ensureLoaded, nameOf, reset }
})
