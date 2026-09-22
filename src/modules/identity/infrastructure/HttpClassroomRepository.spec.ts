import { beforeEach, describe, expect, it, vi } from 'vitest'
import { classroomRepository } from '@/modules/identity/infrastructure/HttpClassroomRepository'
import { identityRequests } from '@/modules/identity/infrastructure/client/requests'
import { ApiError } from '@/shared/api/error'

vi.mock('@/modules/identity/infrastructure/client/requests', () => ({
  identityRequests: {
    listClassrooms: vi.fn(),
    createClassroom: vi.fn(),
    updateClassroom: vi.fn(),
    assignClassroomTeachers: vi.fn(),
    deactivateClassroom: vi.fn(),
  },
}))

describe('HttpClassroomRepository', () => {
  beforeEach(() => vi.resetAllMocks())

  it('maps the response into classroom summaries, sorted by name', async () => {
    vi.mocked(identityRequests.listClassrooms).mockResolvedValue([
      { id: 'c-2', name: 'Química 2', subject_id: 's-1', teacher_ids: [], student_count: 0, active: true },
      { id: 'c-1', name: 'Química 1', subject_id: 's-1', teacher_ids: ['t-1'], student_count: 2, active: true },
    ])

    const classrooms = await classroomRepository.list()

    expect(classrooms.map((classroom) => classroom.id)).toEqual(['c-1', 'c-2'])
    expect(classrooms[0]).toEqual({
      id: 'c-1',
      name: 'Química 1',
      subjectId: 's-1',
      teacherIds: ['t-1'],
      studentCount: 2,
      active: true,
    })
  })

  it('creates a classroom by posting the given id, name and subjectId', async () => {
    vi.mocked(identityRequests.createClassroom).mockResolvedValue({
      id: 'c-1',
      name: 'Química 1',
      subject_id: 's-1',
      teacher_ids: [],
      student_count: 0,
      active: true,
    })

    const classroom = await classroomRepository.create({ id: 'c-1', name: 'Química 1', subjectId: 's-1' })

    expect(identityRequests.createClassroom).toHaveBeenCalledWith({ id: 'c-1', name: 'Química 1', subject_id: 's-1' })
    expect(classroom).toEqual({
      id: 'c-1',
      name: 'Química 1',
      subjectId: 's-1',
      teacherIds: [],
      studentCount: 0,
      active: true,
    })
  })

  it('updates a classroom by id, sending name and subjectId', async () => {
    vi.mocked(identityRequests.updateClassroom).mockResolvedValue({
      id: 'c-1',
      name: 'Química 1A',
      subject_id: 's-2',
      teacher_ids: [],
      student_count: 0,
      active: true,
    })

    const classroom = await classroomRepository.update('c-1', { name: 'Química 1A', subjectId: 's-2' })

    expect(identityRequests.updateClassroom).toHaveBeenCalledWith('c-1', { name: 'Química 1A', subject_id: 's-2' })
    expect(classroom.name).toBe('Química 1A')
    expect(classroom.subjectId).toBe('s-2')
  })

  it('replaces the teacher set by id', async () => {
    vi.mocked(identityRequests.assignClassroomTeachers).mockResolvedValue({
      id: 'c-1',
      name: 'Química 1',
      subject_id: 's-1',
      teacher_ids: ['t-1', 't-2'],
      student_count: 0,
      active: true,
    })

    const classroom = await classroomRepository.assignTeachers('c-1', ['t-1', 't-2'])

    expect(identityRequests.assignClassroomTeachers).toHaveBeenCalledWith('c-1', { teacher_ids: ['t-1', 't-2'] })
    expect(classroom.teacherIds).toEqual(['t-1', 't-2'])
  })

  it('deactivates a classroom by id', async () => {
    vi.mocked(identityRequests.deactivateClassroom).mockResolvedValue({
      id: 'c-1',
      name: 'Química 1',
      subject_id: 's-1',
      teacher_ids: [],
      student_count: 0,
      active: false,
    })

    const classroom = await classroomRepository.deactivate('c-1')

    expect(identityRequests.deactivateClassroom).toHaveBeenCalledWith('c-1')
    expect(classroom.active).toBe(false)
  })

  it('lets an ApiError propagate untouched', async () => {
    vi.mocked(identityRequests.listClassrooms).mockRejectedValue(new ApiError('auth.unauthenticated', {}, 401))

    await expect(classroomRepository.list()).rejects.toBeInstanceOf(ApiError)
  })
})
