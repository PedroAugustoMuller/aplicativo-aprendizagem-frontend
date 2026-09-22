import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useClassroomStore } from '@/modules/identity/application/classroomStore'
import { classroomRepository } from '@/modules/identity/infrastructure/HttpClassroomRepository'
import { ApiError } from '@/shared/api/error'
import type { ClassroomDetail } from '@/modules/identity/domain/Classroom'

vi.mock('@/modules/identity/infrastructure/HttpClassroomRepository', () => ({
  classroomRepository: { list: vi.fn(), create: vi.fn(), update: vi.fn(), assignTeachers: vi.fn(), deactivate: vi.fn() },
}))

const detail = (overrides: Partial<ClassroomDetail> = {}): ClassroomDetail => ({
  id: 'c-1',
  name: 'Química 1',
  subjectId: 's-1',
  teacherIds: [],
  studentCount: 0,
  active: true,
  ...overrides,
})

describe('classroomStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })

  it('loads classrooms sorted by name and clears the loading flag', async () => {
    vi.mocked(classroomRepository.list).mockResolvedValue([detail({ id: 'c-1', name: 'Química 1' })])

    const store = useClassroomStore()
    await store.load()

    expect(store.classrooms).toHaveLength(1)
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('records a load failure as an ApiError', async () => {
    vi.mocked(classroomRepository.list).mockRejectedValue(new ApiError('api.network_unavailable'))

    const store = useClassroomStore()
    await store.load()

    expect(store.error?.code).toBe('api.network_unavailable')
    expect(store.loading).toBe(false)
  })

  it('create upserts the new classroom in name order', async () => {
    vi.mocked(classroomRepository.list).mockResolvedValue([detail({ id: 'c-1', name: 'Química 2' })])
    vi.mocked(classroomRepository.create).mockResolvedValue(detail({ id: 'c-2', name: 'Química 1' }))

    const store = useClassroomStore()
    await store.load()
    const created = await store.create({ id: 'c-2', name: 'Química 1', subjectId: 's-1' })

    expect(created.id).toBe('c-2')
    expect(store.classrooms.map((classroom) => classroom.id)).toEqual(['c-2', 'c-1'])
  })

  it('update replaces the classroom in place', async () => {
    vi.mocked(classroomRepository.list).mockResolvedValue([detail({ id: 'c-1', name: 'Química 1' })])
    vi.mocked(classroomRepository.update).mockResolvedValue(detail({ id: 'c-1', name: 'Química 1A', subjectId: 's-2' }))

    const store = useClassroomStore()
    await store.load()
    await store.update('c-1', { name: 'Química 1A', subjectId: 's-2' })

    expect(store.classrooms).toEqual([detail({ id: 'c-1', name: 'Química 1A', subjectId: 's-2' })])
  })

  it('assignTeachers replaces the teacher set on the classroom', async () => {
    vi.mocked(classroomRepository.list).mockResolvedValue([detail({ id: 'c-1', teacherIds: ['t-1'] })])
    vi.mocked(classroomRepository.assignTeachers).mockResolvedValue(detail({ id: 'c-1', teacherIds: ['t-2', 't-3'] }))

    const store = useClassroomStore()
    await store.load()
    await store.assignTeachers('c-1', ['t-2', 't-3'])

    expect(classroomRepository.assignTeachers).toHaveBeenCalledWith('c-1', ['t-2', 't-3'])
    expect(store.classrooms[0]?.teacherIds).toEqual(['t-2', 't-3'])
  })

  it('deactivate flips active on the classroom', async () => {
    vi.mocked(classroomRepository.list).mockResolvedValue([detail({ id: 'c-1' })])
    vi.mocked(classroomRepository.deactivate).mockResolvedValue(detail({ id: 'c-1', active: false }))

    const store = useClassroomStore()
    await store.load()
    await store.deactivate('c-1')

    expect(store.classrooms[0]?.active).toBe(false)
  })

  it('find returns the classroom by id or null when unknown', async () => {
    vi.mocked(classroomRepository.list).mockResolvedValue([detail({ id: 'c-1' })])

    const store = useClassroomStore()
    await store.load()

    expect(store.find('c-1')).toEqual(detail({ id: 'c-1' }))
    expect(store.find('missing')).toBeNull()
  })

  it('rethrows a failed create and leaves classrooms untouched', async () => {
    vi.mocked(classroomRepository.list).mockResolvedValue([])
    vi.mocked(classroomRepository.create).mockRejectedValue(
      new ApiError('identity.classroom.name_already_taken', { name: 'Química 1' }, 409),
    )

    const store = useClassroomStore()
    await store.load()

    await expect(store.create({ id: 'c-1', name: 'Química 1', subjectId: 's-1' })).rejects.toBeInstanceOf(ApiError)
    expect(store.classrooms).toEqual([])
    // The dialog owns this failure - the list-level error stays untouched.
    expect(store.error).toBeNull()
  })

  it('reset clears the cached list and any error', async () => {
    vi.mocked(classroomRepository.list).mockRejectedValue(new ApiError('api.network_unavailable'))

    const store = useClassroomStore()
    await store.load()
    expect(store.error).not.toBeNull()

    store.reset()

    expect(store.classrooms).toEqual([])
    expect(store.error).toBeNull()
  })
})
