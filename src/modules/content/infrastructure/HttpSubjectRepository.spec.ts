import { beforeEach, describe, expect, it, vi } from 'vitest'
import { subjectRepository } from '@/modules/content/infrastructure/HttpSubjectRepository'
import { contentRequests } from '@/modules/content/infrastructure/client/requests'
import { ApiError } from '@/shared/api/error'

vi.mock('@/modules/content/infrastructure/client/requests', () => ({
  contentRequests: { listSubjects: vi.fn(), listTopics: vi.fn() },
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
})
