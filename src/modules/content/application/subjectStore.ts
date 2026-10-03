import { ref } from 'vue'
import { defineStore } from 'pinia'
import { subjectRepository } from '@/modules/content/infrastructure/HttpSubjectRepository'
import { readThrough } from '@/shared/offline/readThrough'
import { ApiError } from '@/shared/api/error'
import type { Subject } from '@/modules/content/domain/Subject'

export const useSubjectStore = defineStore('subjects', () => {
  const subjects = ref<Subject[]>([])
  const savedAt = ref<Date | null>(null)
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
        const snapshot = await readThrough('content:subjects', () => subjectRepository.list())

        if (started === generation) {
          subjects.value = snapshot.value
          savedAt.value = snapshot.savedAt
          // A saved copy shows now, but the next ensureLoaded() still asks the server.
          loaded.value = snapshot.savedAt === null
        }
      } catch (failure: unknown) {
        if (started === generation) {
          error.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
          subjects.value = []
          savedAt.value = null
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

  // Writes need a connection and let their ApiError reach the dialog that asked.
  async function create(input: { id: string; name: string }): Promise<void> {
    await subjectRepository.create(input)
    await load()
  }

  async function rename(id: string, name: string): Promise<void> {
    await subjectRepository.rename(id, name)
    await load()
  }

  async function deactivate(id: string): Promise<void> {
    await subjectRepository.deactivate(id)
    await load()
  }

  function reset(): void {
    generation += 1
    inFlight = null
    loading.value = false
    subjects.value = []
    savedAt.value = null
    loaded.value = false
    error.value = null
  }

  function nameOf(id: string): string | null {
    return subjects.value.find((subject) => subject.id === id)?.name ?? null
  }

  function canAuthor(id: string): boolean {
    return subjects.value.find((subject) => subject.id === id)?.canAuthor === true
  }

  return { subjects, savedAt, loading, error, load, ensureLoaded, nameOf, canAuthor, reset, create, rename, deactivate }
})
