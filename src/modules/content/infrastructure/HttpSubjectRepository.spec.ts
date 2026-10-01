import { beforeEach, describe, expect, it, vi } from 'vitest'
import { subjectRepository } from '@/modules/content/infrastructure/HttpSubjectRepository'
import { contentRequests } from '@/modules/content/infrastructure/client/requests'
import { ApiError } from '@/shared/api/error'

vi.mock('@/modules/content/infrastructure/client/requests', () => ({
  contentRequests: {
    listSubjects: vi.fn(),
    listTopics: vi.fn(),
    createSubject: vi.fn(),
    renameSubject: vi.fn(),
    deactivateSubject: vi.fn(),
  },
}))

describe('HttpSubjectRepository', () => {
  beforeEach(() => vi.resetAllMocks())

  it('maps the response into domain subjects', async () => {
    vi.mocked(contentRequests.listSubjects).mockResolvedValue([{ id: 's-1', name: 'Química', active: true }])

    await expect(subjectRepository.list()).resolves.toEqual([{ id: 's-1', name: 'Química', active: true }])
  })

  it('sorts by name the way a Portuguese reader expects', async () => {
    vi.mocked(contentRequests.listSubjects).mockResolvedValue([
      { id: 'q', name: 'Química', active: true },
      { id: 'b', name: 'Biologia', active: true },
      { id: 'a', name: 'Álgebra', active: false },
    ])

    const subjects = await subjectRepository.list()

    expect(subjects.map((subject) => subject.id)).toEqual(['a', 'b', 'q'])
  })

  it('lets an ApiError propagate', async () => {
    vi.mocked(contentRequests.listSubjects).mockRejectedValue(new ApiError('api.network_unavailable'))

    await expect(subjectRepository.list()).rejects.toBeInstanceOf(ApiError)
  })

  it('creates a subject under the id the client chose', async () => {
    vi.mocked(contentRequests.createSubject).mockResolvedValue({ id: 's-9', name: 'Física', active: true })

    await expect(subjectRepository.create({ id: 's-9', name: 'Física' }))
      .resolves.toEqual({ id: 's-9', name: 'Física', active: true })
    expect(contentRequests.createSubject).toHaveBeenCalledWith({ id: 's-9', name: 'Física' })
  })

  it('renames and deactivates by id', async () => {
    vi.mocked(contentRequests.renameSubject).mockResolvedValue({ id: 's-1', name: 'Química I', active: true })
    vi.mocked(contentRequests.deactivateSubject).mockResolvedValue({ id: 's-1', name: 'Química I', active: false })

    await subjectRepository.rename('s-1', 'Química I')
    await expect(subjectRepository.deactivate('s-1')).resolves.toMatchObject({ active: false })
    expect(contentRequests.renameSubject).toHaveBeenCalledWith('s-1', 'Química I')
    expect(contentRequests.deactivateSubject).toHaveBeenCalledWith('s-1')
  })
})
