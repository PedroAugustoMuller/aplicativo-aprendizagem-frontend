import { ref } from 'vue'
import { defineStore } from 'pinia'
import { classroomRepository } from '@/modules/identity/infrastructure/HttpClassroomRepository'
import { ApiError } from '@/shared/api/error'
import type { ClassroomDetail, ClassroomSummary } from '@/modules/identity/domain/Classroom'

export const useClassroomStore = defineStore('classrooms', () => {
  const classrooms = ref<ClassroomSummary[]>([])
  const loading = ref(false)
  const error = ref<ApiError | null>(null)

  async function load(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      classrooms.value = await classroomRepository.list()
    } catch (failure: unknown) {
      error.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
    } finally {
      loading.value = false
    }
  }

  function upsert(detail: ClassroomDetail): ClassroomDetail {
    const others = classrooms.value.filter((existing) => existing.id !== detail.id)
    classrooms.value = [...others, detail].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    return detail
  }

  // Mutations rethrow the ApiError for the caller's dialog to render as a field
  // error; they never touch the list-level `error`, which belongs to `load()`.
  const create = async (input: { id: string; name: string; subjectId: string }): Promise<ClassroomDetail> =>
    upsert(await classroomRepository.create(input))
  const update = async (id: string, input: { name: string; subjectId: string }): Promise<ClassroomDetail> =>
    upsert(await classroomRepository.update(id, input))
  const assignTeachers = async (id: string, teacherIds: readonly string[]): Promise<ClassroomDetail> =>
    upsert(await classroomRepository.assignTeachers(id, teacherIds))
  const deactivate = async (id: string): Promise<ClassroomDetail> => upsert(await classroomRepository.deactivate(id))

  const find = (id: string): ClassroomSummary | null => classrooms.value.find((classroom) => classroom.id === id) ?? null

  // A second user signing in on the same phone must not see the first user's
  // classrooms. Task 7 wires this into the shared reset-all-stores helper.
  function reset(): void {
    classrooms.value = []
    error.value = null
  }

  return {
    classrooms,
    loading,
    error,
    load,
    create,
    update,
    assignTeachers,
    deactivate,
    find,
    reset,
  }
})
