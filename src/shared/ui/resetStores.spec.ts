import { describe, expect, it } from 'vitest'
import { createPinia } from 'pinia'
import { resetSharedStores } from '@/shared/ui/resetStores'
import { useSubjectStore } from '@/modules/content/application/subjectStore'
import { useTopicStore } from '@/modules/content/application/topicStore'
import { useTeacherStore } from '@/modules/identity/application/teacherStore'
import { useClassroomStore } from '@/modules/identity/application/classroomStore'
import { useRosterStore } from '@/modules/identity/application/rosterStore'
import { ApiError } from '@/shared/api/error'

describe('resetSharedStores', () => {
  it('clears every module store that caches server data', () => {
    const pinia = createPinia()

    const subjects = useSubjectStore(pinia)
    const topics = useTopicStore(pinia)
    const teachers = useTeacherStore(pinia)
    const classrooms = useClassroomStore(pinia)
    const roster = useRosterStore(pinia)

    // Seed each store as if a previous user had used the app on this device.
    subjects.subjects = [{ id: 's-1', name: 'Química', active: true }]
    subjects.loaded = true
    subjects.error = new ApiError('api.network_unavailable')

    topics.topics = [{ id: 'tp-1', name: 'Ligações Químicas', description: '', position: 1 }]
    topics.error = new ApiError('api.network_unavailable')

    teachers.teachers = [{ id: 't-1', name: 'Bruno', login: 'bruno@escola.br', mustChangePassword: false, active: true }]
    teachers.error = new ApiError('api.network_unavailable')

    classrooms.classrooms = [
      { id: 'c-1', name: 'Química 1', subjectId: 's-1', teacherIds: ['t-1'], studentCount: 2, active: true },
    ]
    classrooms.error = new ApiError('api.network_unavailable')

    roster.classroomId = 'c-1'
    roster.students = [{ id: 'st-1', name: 'Carla', login: 'carla.dias', mustChangePassword: false, active: true }]
    roster.error = new ApiError('api.network_unavailable')

    resetSharedStores(pinia)

    expect(subjects.subjects).toEqual([])
    expect(subjects.loaded).toBe(false)
    expect(subjects.error).toBeNull()

    expect(topics.topics).toEqual([])
    expect(topics.error).toBeNull()

    expect(teachers.teachers).toEqual([])
    expect(teachers.error).toBeNull()

    expect(classrooms.classrooms).toEqual([])
    expect(classrooms.error).toBeNull()

    expect(roster.classroomId).toBeNull()
    expect(roster.students).toEqual([])
    expect(roster.error).toBeNull()
  })
})
