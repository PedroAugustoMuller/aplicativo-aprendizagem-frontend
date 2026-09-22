import { computed, ref } from 'vue'
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

  const activeSubjects = computed(() => subjects.value.filter((subject) => subject.active))

  async function load(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      subjects.value = await subjectRepository.list()
      loaded.value = true
    } catch (failure: unknown) {
      error.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
    } finally {
      loading.value = false
    }
  }

  function ensureLoaded(): Promise<void> {
    if (loaded.value) {
      return Promise.resolve()
    }

    inFlight ??= load().finally(() => {
      inFlight = null
    })

    return inFlight
  }

  function upsert(subject: Subject): Subject {
    const others = subjects.value.filter((existing) => existing.id !== subject.id)
    subjects.value = [...others, subject].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    return subject
  }

  // Mutations rethrow the ApiError for the caller's dialog to render as a field
  // error; they never touch the list-level `error`, which belongs to `load()`.
  const create = async (input: { id: string; name: string }): Promise<Subject> => upsert(await subjectRepository.create(input))
  const rename = async (id: string, name: string): Promise<Subject> => upsert(await subjectRepository.rename(id, name))
  const deactivate = async (id: string): Promise<Subject> => upsert(await subjectRepository.deactivate(id))

  const nameOf = (id: string): string | null => subjects.value.find((subject) => subject.id === id)?.name ?? null

  // A second user signing in on the same phone must not see the first user's
  // subjects; called from AppLayout.signOut() and main.ts's onUnauthorized.
  function reset(): void {
    subjects.value = []
    loaded.value = false
    error.value = null
  }

  return {
    subjects,
    loading,
    loaded,
    error,
    activeSubjects,
    load,
    ensureLoaded,
    create,
    rename,
    deactivate,
    nameOf,
    reset,
  }
})
