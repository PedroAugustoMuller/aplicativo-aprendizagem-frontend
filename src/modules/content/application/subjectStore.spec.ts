import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSubjectStore } from '@/modules/content/application/subjectStore'
import { subjectRepository } from '@/modules/content/infrastructure/HttpSubjectRepository'
import { ApiError } from '@/shared/api/error'

vi.mock('@/modules/content/infrastructure/HttpSubjectRepository', () => ({
  subjectRepository: { list: vi.fn(), create: vi.fn(), rename: vi.fn(), deactivate: vi.fn() },
}))

describe('subjectStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })

  it('loads subjects and clears the loading flag', async () => {
    vi.mocked(subjectRepository.list).mockResolvedValue([{ id: 's-1', name: 'Química', active: true }])

    const store = useSubjectStore()
    await store.load()

    expect(store.subjects).toHaveLength(1)
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
    expect(store.loaded).toBe(true)
  })

  it('records a load failure as an ApiError', async () => {
    vi.mocked(subjectRepository.list).mockRejectedValue(new ApiError('api.network_unavailable'))

    const store = useSubjectStore()
    await store.load()

    expect(store.error?.code).toBe('api.network_unavailable')
    expect(store.loading).toBe(false)
  })

  it('ensureLoaded calls the repository once across two concurrent calls', async () => {
    let resolveList: (value: { id: string; name: string; active: boolean }[]) => void = () => {}
    vi.mocked(subjectRepository.list).mockImplementation(
      () => new Promise((resolve) => { resolveList = resolve }),
    )

    const store = useSubjectStore()
    const first = store.ensureLoaded()
    const second = store.ensureLoaded()

    resolveList([{ id: 's-1', name: 'Química', active: true }])
    await Promise.all([first, second])

    expect(subjectRepository.list).toHaveBeenCalledTimes(1)
  })

  it('ensureLoaded does not reload once loaded', async () => {
    vi.mocked(subjectRepository.list).mockResolvedValue([{ id: 's-1', name: 'Química', active: true }])

    const store = useSubjectStore()
    await store.ensureLoaded()
    await store.ensureLoaded()

    expect(subjectRepository.list).toHaveBeenCalledTimes(1)
  })

  it('create appends the new subject and keeps name order', async () => {
    vi.mocked(subjectRepository.list).mockResolvedValue([{ id: 's-1', name: 'Química', active: true }])
    vi.mocked(subjectRepository.create).mockResolvedValue({ id: 's-2', name: 'Biologia', active: true })

    const store = useSubjectStore()
    await store.load()
    const created = await store.create({ id: 's-2', name: 'Biologia' })

    expect(created).toEqual({ id: 's-2', name: 'Biologia', active: true })
    expect(store.subjects.map((subject) => subject.name)).toEqual(['Biologia', 'Química'])
  })

  it('rename replaces the subject in place', async () => {
    vi.mocked(subjectRepository.list).mockResolvedValue([{ id: 's-1', name: 'Química', active: true }])
    vi.mocked(subjectRepository.rename).mockResolvedValue({ id: 's-1', name: 'Físico-Química', active: true })

    const store = useSubjectStore()
    await store.load()
    await store.rename('s-1', 'Físico-Química')

    expect(store.subjects).toEqual([{ id: 's-1', name: 'Físico-Química', active: true }])
  })

  it('deactivate flips active on the subject', async () => {
    vi.mocked(subjectRepository.list).mockResolvedValue([{ id: 's-1', name: 'Química', active: true }])
    vi.mocked(subjectRepository.deactivate).mockResolvedValue({ id: 's-1', name: 'Química', active: false })

    const store = useSubjectStore()
    await store.load()
    await store.deactivate('s-1')

    expect(store.subjects).toEqual([{ id: 's-1', name: 'Química', active: false }])
    expect(store.activeSubjects).toEqual([])
  })

  it('nameOf returns the name or null when unknown', async () => {
    vi.mocked(subjectRepository.list).mockResolvedValue([{ id: 's-1', name: 'Química', active: true }])

    const store = useSubjectStore()
    await store.load()

    expect(store.nameOf('s-1')).toBe('Química')
    expect(store.nameOf('missing')).toBeNull()
  })

  it('rethrows a failed create and leaves subjects untouched', async () => {
    vi.mocked(subjectRepository.list).mockResolvedValue([{ id: 's-1', name: 'Química', active: true }])
    vi.mocked(subjectRepository.create).mockRejectedValue(
      new ApiError('content.subject.name_already_taken', { name: 'Química' }, 409),
    )

    const store = useSubjectStore()
    await store.load()

    await expect(store.create({ id: 's-2', name: 'Química' })).rejects.toBeInstanceOf(ApiError)
    expect(store.subjects).toEqual([{ id: 's-1', name: 'Química', active: true }])
    // The dialog owns this failure - the list-level error stays untouched.
    expect(store.error).toBeNull()
  })

  it('reset makes the next ensureLoaded fetch again', async () => {
    vi.mocked(subjectRepository.list).mockResolvedValue([{ id: 's-1', name: 'Química', active: true }])

    const store = useSubjectStore()
    await store.ensureLoaded()
    store.reset()
    await store.ensureLoaded()

    expect(subjectRepository.list).toHaveBeenCalledTimes(2)
    expect(store.subjects).toHaveLength(1)
  })

  it('reset clears subjects and any error', async () => {
    vi.mocked(subjectRepository.list).mockRejectedValue(new ApiError('api.network_unavailable'))

    const store = useSubjectStore()
    await store.load()
    expect(store.error).not.toBeNull()

    store.reset()

    expect(store.subjects).toEqual([])
    expect(store.error).toBeNull()
    expect(store.loaded).toBe(false)
  })
})
