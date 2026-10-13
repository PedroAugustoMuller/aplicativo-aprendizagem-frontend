import { ref } from 'vue'
import { defineStore } from 'pinia'
import { classroomRepository } from '@/modules/identity/infrastructure/HttpClassroomRepository'
import { readThrough } from '@/shared/offline/readThrough'
import { ApiError } from '@/shared/api/error'
import type { Classroom, ClassroomInput, SubjectOption, TeacherAssignment } from '@/modules/identity/domain/Classroom'

const older = (a: Date | null, b: Date | null): Date | null => {
  if (a === null) {
    return b
  }

  return b === null || a <= b ? a : b
}

export const useClassroomStore = defineStore('classrooms', () => {
  const classrooms = ref<Classroom[]>([])
  const subjects = ref<SubjectOption[]>([])
  const savedAt = ref<Date | null>(null)
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref<ApiError | null>(null)
  let latest = 0

  async function load(): Promise<void> {
    const request = ++latest
    loading.value = true
    error.value = null

    try {
      const [classroomSnapshot, subjectSnapshot] = await Promise.all([
        // v2: classrooms hold several subjects; an old snapshot has another shape.
        readThrough('identity:classrooms:v2', () => classroomRepository.list()),
        readThrough('identity:subject-options', () => classroomRepository.subjectOptions()),
      ])

      if (request === latest) {
        classrooms.value = classroomSnapshot.value
        subjects.value = subjectSnapshot.value
        // The banner shows the oldest data on screen.
        savedAt.value = older(classroomSnapshot.savedAt, subjectSnapshot.savedAt)
        loaded.value = true
      }
    } catch (failure: unknown) {
      if (request === latest) {
        error.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
        classrooms.value = []
        subjects.value = []
        savedAt.value = null
        loaded.value = false
      }
    } finally {
      if (request === latest) {
        loading.value = false
      }
    }
  }

  async function ensureLoaded(): Promise<void> {
    if (!loaded.value) {
      await load()
    }
  }

  const find = (id: string): Classroom | null => classrooms.value.find((classroom) => classroom.id === id) ?? null
  const subjectName = (id: string): string | null => subjects.value.find((subject) => subject.id === id)?.name ?? null

  async function create(id: string, input: ClassroomInput): Promise<void> {
    await classroomRepository.create(id, input)
    await load()
  }

  async function rename(id: string, name: string): Promise<void> {
    await classroomRepository.rename(id, name)
    await load()
  }

  async function replaceSubjects(id: string, subjectIds: readonly string[]): Promise<void> {
    await classroomRepository.replaceSubjects(id, subjectIds)
    await load()
  }

  async function assignTeachers(id: string, assignments: readonly TeacherAssignment[]): Promise<void> {
    await classroomRepository.assignTeachers(id, assignments)
    await load()
  }

  async function deactivate(id: string): Promise<void> {
    await classroomRepository.deactivate(id)
    await load()
  }

  function reset(): void {
    latest += 1
    classrooms.value = []
    subjects.value = []
    savedAt.value = null
    loading.value = false
    loaded.value = false
    error.value = null
  }

  return {
    classrooms, subjects, savedAt, loading, error,
    load, ensureLoaded, find, subjectName, create, rename, replaceSubjects, assignTeachers, deactivate, reset,
  }
})
