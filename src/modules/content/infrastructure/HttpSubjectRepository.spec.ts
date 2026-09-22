import { beforeEach, describe, expect, it, vi } from 'vitest'
import { subjectRepository } from '@/modules/content/infrastructure/HttpSubjectRepository'
import { contentRequests } from '@/modules/content/infrastructure/client/requests'
import { ApiError } from '@/shared/api/error'

vi.mock('@/modules/content/infrastructure/client/requests', () => ({
  contentRequests: {
    listSubjects: vi.fn(),
    createSubject: vi.fn(),
    renameSubject: vi.fn(),
    deactivateSubject: vi.fn(),
  },
}))

describe('HttpSubjectRepository', () => {
  beforeEach(() => vi.resetAllMocks())

  it('maps the response into domain subjects, sorted by name', async () => {
    vi.mocked(contentRequests.listSubjects).mockResolvedValue([
      { id: 's-2', name: 'Química', active: true },
      { id: 's-1', name: 'Biologia', active: true },
    ])

    const subjects = await subjectRepository.list()

    expect(subjects.map((subject) => subject.id)).toEqual(['s-1', 's-2'])
    expect(subjects).toEqual([
      { id: 's-1', name: 'Biologia', active: true },
      { id: 's-2', name: 'Química', active: true },
    ])
  })

  it('sorts using pt-BR collation', async () => {
    vi.mocked(contentRequests.listSubjects).mockResolvedValue([
      { id: 's-2', name: 'Ética', active: true },
      { id: 's-1', name: 'Artes', active: true },
    ])

    const subjects = await subjectRepository.list()

    expect(subjects.map((subject) => subject.id)).toEqual(['s-1', 's-2'])
  })

  it('creates a subject by posting the given id and name', async () => {
    vi.mocked(contentRequests.createSubject).mockResolvedValue({ id: 's-1', name: 'Física', active: true })

    const subject = await subjectRepository.create({ id: 's-1', name: 'Física' })

    expect(contentRequests.createSubject).toHaveBeenCalledWith({ id: 's-1', name: 'Física' })
    expect(subject).toEqual({ id: 's-1', name: 'Física', active: true })
  })

  it('renames a subject by patching with the id in urlParams', async () => {
    vi.mocked(contentRequests.renameSubject).mockResolvedValue({ id: 's-1', name: 'Nova', active: true })

    const subject = await subjectRepository.rename('s-1', 'Nova')

    expect(contentRequests.renameSubject).toHaveBeenCalledWith('s-1', { name: 'Nova' })
    expect(subject).toEqual({ id: 's-1', name: 'Nova', active: true })
  })

  it('deactivates a subject', async () => {
    vi.mocked(contentRequests.deactivateSubject).mockResolvedValue({ id: 's-1', name: 'Física', active: false })

    const subject = await subjectRepository.deactivate('s-1')

    expect(contentRequests.deactivateSubject).toHaveBeenCalledWith('s-1')
    expect(subject).toEqual({ id: 's-1', name: 'Física', active: false })
  })

  it('lets an ApiError propagate untouched', async () => {
    vi.mocked(contentRequests.listSubjects).mockRejectedValue(new ApiError('auth.unauthenticated', {}, 401))

    await expect(subjectRepository.list()).rejects.toBeInstanceOf(ApiError)
  })
})
