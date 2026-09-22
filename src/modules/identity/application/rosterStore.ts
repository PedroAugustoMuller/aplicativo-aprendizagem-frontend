import { ref } from 'vue'
import { defineStore } from 'pinia'
import { studentRepository } from '@/modules/identity/infrastructure/HttpStudentRepository'
import { ApiError } from '@/shared/api/error'
import type { AccountDetail, AccountSummary, CredentialSlip } from '@/modules/identity/domain/Account'

export const useRosterStore = defineStore('roster', () => {
  const classroomId = ref<string | null>(null)
  const students = ref<AccountSummary[]>([])
  const slips = ref<CredentialSlip[]>([])
  const loading = ref(false)
  const error = ref<ApiError | null>(null)

  async function load(id: string): Promise<void> {
    classroomId.value = id
    loading.value = true
    error.value = null

    try {
      students.value = await studentRepository.listByClassroom(id)
    } catch (failure: unknown) {
      error.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
    } finally {
      loading.value = false
    }
  }

  // Independent of load()/students: the print page needs only the pending
  // students' plaintext credentials, not the full roster.
  async function loadSlips(id: string): Promise<void> {
    loading.value = true
    error.value = null

    try {
      slips.value = await studentRepository.credentials(id)
    } catch (failure: unknown) {
      error.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
    } finally {
      loading.value = false
    }
  }

  // Mutations below reload the authoritative list (via load(), which already
  // owns loading/error) after a successful write, and rethrow untouched on
  // failure - the caller (a dialog or a row action) renders that failure.
  async function createMany(rows: readonly { id: string; name: string }[]): Promise<AccountDetail[]> {
    const id = classroomId.value
    if (id === null) {
      throw new ApiError('system.unexpected_error')
    }

    const created = await studentRepository.createInClassroom(id, rows)
    await load(id)
    return created
  }

  async function moveTo(studentId: string, targetClassroomId: string): Promise<void> {
    const id = classroomId.value
    if (id === null) {
      throw new ApiError('system.unexpected_error')
    }

    // Enrol in the target FIRST: if that fails, the student stays exactly
    // where they were instead of being unenrolled from a classroom they can
    // no longer reach.
    await studentRepository.enrol(targetClassroomId, studentId)
    await studentRepository.unenrol(id, studentId)
    await load(id)
  }

  async function unenrol(studentId: string): Promise<void> {
    const id = classroomId.value
    if (id === null) {
      throw new ApiError('system.unexpected_error')
    }

    await studentRepository.unenrol(id, studentId)
    await load(id)
  }

  async function resetPassword(studentId: string): Promise<AccountDetail> {
    const detail = await studentRepository.resetPassword(studentId)
    if (classroomId.value !== null) {
      await load(classroomId.value)
    }
    return detail
  }

  async function setActive(studentId: string, active: boolean): Promise<AccountDetail> {
    const detail = await studentRepository.setActive(studentId, active)
    if (classroomId.value !== null) {
      await load(classroomId.value)
    }
    return detail
  }

  // A second user signing in on the same phone must not see the first user's
  // roster. Wired into the shared reset-all-stores helper.
  function reset(): void {
    classroomId.value = null
    students.value = []
    slips.value = []
    loading.value = false
    error.value = null
  }

  return {
    classroomId,
    students,
    slips,
    loading,
    error,
    load,
    loadSlips,
    createMany,
    moveTo,
    unenrol,
    resetPassword,
    setActive,
    reset,
  }
})
