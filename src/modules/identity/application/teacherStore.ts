import { ref } from 'vue'
import { defineStore } from 'pinia'
import { teacherRepository } from '@/modules/identity/infrastructure/HttpTeacherRepository'
import { ApiError } from '@/shared/api/error'
import type { AccountDetail, AccountSummary } from '@/modules/identity/domain/Account'

export const useTeacherStore = defineStore('teachers', () => {
  const teachers = ref<AccountSummary[]>([])
  const loading = ref(false)
  const error = ref<ApiError | null>(null)

  async function load(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      teachers.value = await teacherRepository.list()
    } catch (failure: unknown) {
      error.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
    } finally {
      loading.value = false
    }
  }

  // Only the summary fields go into the list; the caller (a dialog) keeps the
  // full detail, which carries the one-time temporaryPassword.
  function upsert(detail: AccountDetail): AccountDetail {
    const summary: AccountSummary = {
      id: detail.id,
      name: detail.name,
      login: detail.login,
      mustChangePassword: detail.mustChangePassword,
      active: detail.active,
    }
    const others = teachers.value.filter((existing) => existing.id !== summary.id)
    teachers.value = [...others, summary].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    return detail
  }

  // Mutations rethrow the ApiError for the caller's dialog to render as a field
  // error; they never touch the list-level `error`, which belongs to `load()`.
  const create = async (input: { id: string; name: string; email: string }): Promise<AccountDetail> =>
    upsert(await teacherRepository.create(input))
  const resetPassword = async (id: string): Promise<AccountDetail> => upsert(await teacherRepository.resetPassword(id))
  const setActive = async (id: string, active: boolean): Promise<AccountDetail> =>
    upsert(await teacherRepository.setActive(id, active))

  // A second user signing in on the same phone must not see the first user's
  // teacher list. Wired into the shared reset-all-stores helper.
  function reset(): void {
    teachers.value = []
    error.value = null
  }

  return {
    teachers,
    loading,
    error,
    load,
    create,
    resetPassword,
    setActive,
    reset,
  }
})
