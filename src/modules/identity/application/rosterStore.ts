import { ref } from 'vue'
import { defineStore } from 'pinia'
import { studentRepository } from '@/modules/identity/infrastructure/HttpStudentRepository'
import { readThrough } from '@/shared/offline/readThrough'
import { ApiError } from '@/shared/api/error'
import type { IssuedAccount } from '@/modules/identity/domain/IssuedAccount'
import type { Credential, NewStudent, Student, StudentMatch } from '@/modules/identity/domain/Student'

const asApiError = (failure: unknown): ApiError =>
  failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')

export interface EnrolResult {
  readonly studentId: string
  readonly error: ApiError | null
}

export const useRosterStore = defineStore('roster', () => {
  const classroomId = ref<string | null>(null)
  const students = ref<Student[]>([])
  const savedAt = ref<Date | null>(null)
  const loading = ref(false)
  const error = ref<ApiError | null>(null)
  const credentials = ref<Credential[]>([])
  const credentialsLoading = ref(false)
  const credentialsError = ref<ApiError | null>(null)
  let latest = 0

  async function load(nextClassroomId: string): Promise<void> {
    const request = ++latest

    if (classroomId.value !== nextClassroomId) {
      classroomId.value = nextClassroomId
      students.value = []
      savedAt.value = null
    }

    loading.value = true
    error.value = null

    try {
      const snapshot = await readThrough(`identity:roster:${nextClassroomId}`, () =>
        studentRepository.listByClassroom(nextClassroomId),
      )

      if (request === latest) {
        students.value = snapshot.value
        savedAt.value = snapshot.savedAt
      }
    } catch (failure: unknown) {
      if (request === latest) {
        error.value = asApiError(failure)
        students.value = []
        savedAt.value = null
      }
    } finally {
      if (request === latest) {
        loading.value = false
      }
    }
  }

  async function createMany(forClassroomId: string, rows: readonly NewStudent[]): Promise<IssuedAccount[]> {
    const issued = await studentRepository.createMany(forClassroomId, rows)
    await load(forClassroomId)

    return issued
  }

  async function unenrol(forClassroomId: string, studentId: string): Promise<void> {
    await studentRepository.unenrol(forClassroomId, studentId)
    await load(forClassroomId)
  }

  async function resetPassword(forClassroomId: string, studentId: string): Promise<IssuedAccount> {
    const account = await studentRepository.resetPassword(studentId)
    await load(forClassroomId)

    return account
  }

  async function setActive(forClassroomId: string, studentId: string, active: boolean): Promise<void> {
    await studentRepository.setActive(studentId, active)
    await load(forClassroomId)
  }

  // Temporary passwords: always fresh from the server, never saved on the device.
  async function loadCredentials(forClassroomId: string): Promise<void> {
    credentialsLoading.value = true
    credentialsError.value = null

    try {
      credentials.value = await studentRepository.credentials(forClassroomId)
    } catch (failure: unknown) {
      credentialsError.value = asApiError(failure)
      credentials.value = []
    } finally {
      credentialsLoading.value = false
    }
  }

  // Search answers live from the server only: never served stale.
  async function search(text: string): Promise<StudentMatch[]> {
    return studentRepository.search(text)
  }

  // One request per student, in order: a failure names its student instead of
  // hiding the ones that worked. Enrolment is idempotent, so a retry is safe.
  async function enrolMany(forClassroomId: string, studentIds: readonly string[]): Promise<EnrolResult[]> {
    const results: EnrolResult[] = []

    for (const studentId of studentIds) {
      try {
        await studentRepository.enrol(forClassroomId, studentId)
        results.push({ studentId, error: null })
      } catch (failure: unknown) {
        results.push({ studentId, error: asApiError(failure) })
      }
    }

    await load(forClassroomId)

    return results
  }

  function reset(): void {
    latest += 1
    classroomId.value = null
    students.value = []
    savedAt.value = null
    loading.value = false
    error.value = null
    credentials.value = []
    credentialsLoading.value = false
    credentialsError.value = null
  }

  return {
    classroomId, students, savedAt, loading, error, credentials, credentialsLoading, credentialsError,
    load, createMany, unenrol, resetPassword, setActive, loadCredentials, search, enrolMany, reset,
  }
})
