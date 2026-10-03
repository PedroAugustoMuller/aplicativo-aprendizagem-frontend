import { beforeEach, describe, expect, it, vi } from 'vitest'
import { topicRepository } from '@/modules/content/infrastructure/HttpTopicRepository'
import { contentRequests } from '@/modules/content/infrastructure/client/requests'
import { ApiError } from '@/shared/api/error'

vi.mock('@/modules/content/infrastructure/client/requests', () => ({
  contentRequests: {
    listTopics: vi.fn(),
    createTopic: vi.fn(),
    updateTopic: vi.fn(),
    deactivateTopic: vi.fn(),
    reactivateTopic: vi.fn(),
    reorderTopics: vi.fn(),
  },
}))

const ATOMS = { id: 't-1', name: 'Átomos', description: 'Estrutura atômica.', position: 2, active: true }

describe('HttpTopicRepository', () => {
  beforeEach(() => vi.resetAllMocks())

  it('asks for the topics of the given subject', async () => {
    vi.mocked(contentRequests.listTopics).mockResolvedValue([])

    await topicRepository.listBySubject('s-1')

    expect(contentRequests.listTopics).toHaveBeenCalledWith('s-1')
  })

  it('maps a non-author response: no question count', async () => {
    vi.mocked(contentRequests.listTopics).mockResolvedValue([ATOMS])

    await expect(topicRepository.listBySubject('s-1')).resolves.toEqual([
      { id: 't-1', name: 'Átomos', description: 'Estrutura atômica.', position: 2, active: true, questionCount: null },
    ])
  })

  it('maps an author response with its question count', async () => {
    vi.mocked(contentRequests.listTopics).mockResolvedValue([{ ...ATOMS, active: false, active_question_count: 3 }])

    const [topic] = await topicRepository.listBySubject('s-1')

    expect(topic).toMatchObject({ active: false, questionCount: 3 })
  })

  it('sorts by position even if the server does not', async () => {
    vi.mocked(contentRequests.listTopics).mockResolvedValue([
      { ...ATOMS, id: 'b', position: 3 },
      { ...ATOMS, id: 'a', position: 1 },
    ])

    const topics = await topicRepository.listBySubject('s-1')

    expect(topics.map((topic) => topic.id)).toEqual(['a', 'b'])
  })

  it('creates under the id the client chose and edits by id', async () => {
    vi.mocked(contentRequests.createTopic).mockResolvedValue(ATOMS)
    vi.mocked(contentRequests.updateTopic).mockResolvedValue(ATOMS)

    await topicRepository.create('s-1', 't-1', { name: 'Átomos', description: '' })
    await topicRepository.update('t-1', { name: 'Átomos', description: 'x' })

    expect(contentRequests.createTopic).toHaveBeenCalledWith('s-1', { id: 't-1', name: 'Átomos', description: '' })
    expect(contentRequests.updateTopic).toHaveBeenCalledWith('t-1', { name: 'Átomos', description: 'x' })
  })

  it('sends an edit without the fields that were not sent', async () => {
    vi.mocked(contentRequests.updateTopic).mockResolvedValue(ATOMS)

    await topicRepository.update('t-1', { description: 'x' })

    expect(contentRequests.updateTopic).toHaveBeenCalledWith('t-1', { description: 'x' })
  })

  it('deactivates, reactivates and reorders', async () => {
    vi.mocked(contentRequests.deactivateTopic).mockResolvedValue({ ...ATOMS, active: false })
    vi.mocked(contentRequests.reactivateTopic).mockResolvedValue(ATOMS)
    vi.mocked(contentRequests.reorderTopics).mockResolvedValue([{ ...ATOMS, id: 'b', position: 1 }, { ...ATOMS, id: 'a', position: 0 }])

    await expect(topicRepository.deactivate('t-1')).resolves.toMatchObject({ active: false })
    await expect(topicRepository.reactivate('t-1')).resolves.toMatchObject({ active: true })
    const reordered = await topicRepository.reorder('s-1', ['a', 'b'])

    expect(contentRequests.reorderTopics).toHaveBeenCalledWith('s-1', ['a', 'b'])
    expect(reordered.map((topic) => topic.id)).toEqual(['a', 'b'])
  })

  it('lets an ApiError propagate', async () => {
    vi.mocked(contentRequests.listTopics).mockRejectedValue(new ApiError('auth.forbidden', {}, 403))

    await expect(topicRepository.listBySubject('s-1')).rejects.toBeInstanceOf(ApiError)
  })
})
