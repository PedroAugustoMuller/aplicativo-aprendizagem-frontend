import { ref } from 'vue'
import { defineStore } from 'pinia'
import { teacherRepository } from '@/modules/identity/infrastructure/HttpTeacherRepository'
import { readThrough } from '@/shared/offline/readThrough'
import { ApiError } from '@/shared/api/error'
import type { IssuedAccount } from '@/modules/identity/domain/IssuedAccount'
import type { NewTeacher, Teacher } from '@/modules/identity/domain/Teacher'

export const useTeacherStore = defineStore('teachers', () => {
  const teachers = ref<Teacher[]>([])
  const savedAt = ref<Date | null>(null)
  const loading = ref(false)
  const error = ref<ApiError | null>(null)
  // Only the latest load() writes; reset() also invalidates one in flight.
  let latest = 0

  async function load(): Promise<void> {
    const request = ++latest
    loading.value = true
    error.value = null

    try {
      const snapshot = await readThrough('identity:teachers', () => teacherRepository.list())

      if (request === latest) {
        teachers.value = snapshot.value
        savedAt.value = snapshot.savedAt
      }
    } catch (failure: unknown) {
      if (request === latest) {
        error.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
        teachers.value = []
        savedAt.value = null
      }
    } finally {
      if (request === latest) {
        loading.value = false
      }
    }
  }

  // Writes need a connection and let their ApiError reach the dialog that asked.
  async function create(input: NewTeacher): Promise<IssuedAccount> {
    const account = await teacherRepository.create(input)
    await load()

    return account
  }

  async function resetPassword(id: string): Promise<IssuedAccount> {
    const account = await teacherRepository.resetPassword(id)
    await load()

    return account
  }

  async function setActive(id: string, active: boolean): Promise<void> {
    await teacherRepository.setActive(id, active)
    await load()
  }

  function reset(): void {
    latest += 1
    teachers.value = []
    savedAt.value = null
    loading.value = false
    error.value = null
  }

  return { teachers, savedAt, loading, error, load, create, resetPassword, setActive, reset }
})
