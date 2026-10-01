import { beforeEach, describe, expect, it, vi } from 'vitest'
import { classroomRepository } from '@/modules/identity/infrastructure/HttpClassroomRepository'
import { identityRequests } from '@/modules/identity/infrastructure/client/requests'

vi.mock('@/modules/identity/infrastructure/client/requests', () => ({
  identityRequests: {
    listClassrooms: vi.fn(),
    listSubjectOptions: vi.fn(),
    createClassroom: vi.fn(),
    updateClassroom: vi.fn(),
    assignClassroomTeachers: vi.fn(),
    deactivateClassroom: vi.fn(),
  },
}))

const RESPONSE = { id: 'c-1', name: 'Química 1', subject_id: 's-1', teacher_ids: ['t-1'], student_count: 2, active: true }

describe('HttpClassroomRepository', () => {
  beforeEach(() => vi.resetAllMocks())

  it('maps classrooms, sorted by name', async () => {
    vi.mocked(identityRequests.listClassrooms).mockResolvedValue([
      { ...RESPONSE, id: 'c-2', name: 'Química 2' },
      RESPONSE,
    ])

    const classrooms = await classroomRepository.list()

    expect(classrooms.map((classroom) => classroom.id)).toEqual(['c-1', 'c-2'])
    expect(classrooms[0]).toEqual({
      id: 'c-1', name: 'Química 1', subjectId: 's-1', teacherIds: ['t-1'], studentCount: 2, active: true,
    })
  })

  it('maps subject options', async () => {
    vi.mocked(identityRequests.listSubjectOptions).mockResolvedValue([{ id: 's-1', name: 'Química', active: true }])

    await expect(classroomRepository.subjectOptions()).resolves.toEqual([{ id: 's-1', name: 'Química', active: true }])
  })

  it('sends writes in the backend\'s field names', async () => {
    vi.mocked(identityRequests.createClassroom).mockResolvedValue(RESPONSE)
    vi.mocked(identityRequests.updateClassroom).mockResolvedValue(RESPONSE)
    vi.mocked(identityRequests.assignClassroomTeachers).mockResolvedValue(RESPONSE)
    vi.mocked(identityRequests.deactivateClassroom).mockResolvedValue(RESPONSE)

    await classroomRepository.create('c-1', { name: 'Química 1', subjectId: 's-1' })
    await classroomRepository.update('c-1', { name: 'Química A', subjectId: 's-1' })
    await classroomRepository.assignTeachers('c-1', ['t-1', 't-2'])
    await classroomRepository.deactivate('c-1')

    expect(identityRequests.createClassroom).toHaveBeenCalledWith({ id: 'c-1', name: 'Química 1', subject_id: 's-1' })
    expect(identityRequests.updateClassroom).toHaveBeenCalledWith('c-1', { name: 'Química A', subject_id: 's-1' })
    expect(identityRequests.assignClassroomTeachers).toHaveBeenCalledWith('c-1', ['t-1', 't-2'])
    expect(identityRequests.deactivateClassroom).toHaveBeenCalledWith('c-1')
  })
})
