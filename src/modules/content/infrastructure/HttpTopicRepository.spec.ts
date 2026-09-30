import { beforeEach, describe, expect, it, vi } from 'vitest'
import { topicRepository } from '@/modules/content/infrastructure/HttpTopicRepository'
import { contentRequests } from '@/modules/content/infrastructure/client/requests'
import { ApiError } from '@/shared/api/error'

vi.mock('@/modules/content/infrastructure/client/requests', () => ({
  contentRequests: { listSubjects: vi.fn(), listTopics: vi.fn() },
}))

describe('HttpTopicRepository', () => {
  beforeEach(() => vi.resetAllMocks())

  it('asks for the topics of the given subject', async () => {
    vi.mocked(contentRequests.listTopics).mockResolvedValue([])

    await topicRepository.listBySubject('s-1')

    expect(contentRequests.listTopics).toHaveBeenCalledWith('s-1')
  })

  it('maps the response into domain topics', async () => {
    vi.mocked(contentRequests.listTopics).mockResolvedValue([
      { id: 't-1', name: 'Átomos', description: 'Estrutura atômica.', position: 2 },
    ])

    await expect(topicRepository.listBySubject('s-1')).resolves.toEqual([
      { id: 't-1', name: 'Átomos', description: 'Estrutura atômica.', position: 2 },
    ])
  })

  it('sorts by position even if the server does not', async () => {
    vi.mocked(contentRequests.listTopics).mockResolvedValue([
      { id: 'b', name: 'B', description: '', position: 3 },
      { id: 'a', name: 'A', description: '', position: 1 },
    ])

    const topics = await topicRepository.listBySubject('s-1')

    expect(topics.map((topic) => topic.id)).toEqual(['a', 'b'])
  })

  it('lets an ApiError propagate', async () => {
    vi.mocked(contentRequests.listTopics).mockRejectedValue(new ApiError('auth.forbidden', {}, 403))

    await expect(topicRepository.listBySubject('s-1')).rejects.toBeInstanceOf(ApiError)
  })
})
