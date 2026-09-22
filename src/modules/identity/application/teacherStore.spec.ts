import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTeacherStore } from '@/modules/identity/application/teacherStore'
import { teacherRepository } from '@/modules/identity/infrastructure/HttpTeacherRepository'
import { ApiError } from '@/shared/api/error'
import type { AccountDetail } from '@/modules/identity/domain/Account'

vi.mock('@/modules/identity/infrastructure/HttpTeacherRepository', () => ({
  teacherRepository: { list: vi.fn(), create: vi.fn(), resetPassword: vi.fn(), setActive: vi.fn() },
}))

const detail = (overrides: Partial<AccountDetail> = {}): AccountDetail => ({
  id: 't-1',
  name: 'Bruno',
  login: 'bruno@escola.br',
  mustChangePassword: true,
  active: true,
  role: 'teacher',
  temporaryPassword: 'Temp1234',
  ...overrides,
})

describe('teacherStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })

  it('loads teachers and clears the loading flag', async () => {
    vi.mocked(teacherRepository.list).mockResolvedValue([
      { id: 't-1', name: 'Bruno', login: 'bruno@escola.br', mustChangePassword: false, active: true },
    ])

    const store = useTeacherStore()
    await store.load()

    expect(store.teachers).toHaveLength(1)
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('records a load failure as an ApiError', async () => {
    vi.mocked(teacherRepository.list).mockRejectedValue(new ApiError('api.network_unavailable'))

    const store = useTeacherStore()
    await store.load()

    expect(store.error?.code).toBe('api.network_unavailable')
    expect(store.loading).toBe(false)
  })

  it('create appends the summary fields in name order and returns the full detail', async () => {
    vi.mocked(teacherRepository.list).mockResolvedValue([
      { id: 't-1', name: 'Zeca', login: 'zeca@escola.br', mustChangePassword: false, active: true },
    ])
    vi.mocked(teacherRepository.create).mockResolvedValue(detail({ id: 't-2', name: 'Ana', login: 'ana2@escola.br' }))

    const store = useTeacherStore()
    await store.load()
    const created = await store.create({ id: 't-2', name: 'Ana', email: 'ana2@escola.br' })

    expect(created.temporaryPassword).toBe('Temp1234')
    expect(store.teachers.map((teacher) => teacher.name)).toEqual(['Ana', 'Zeca'])
    expect(store.teachers.find((teacher) => teacher.id === 't-2')).toEqual({
      id: 't-2',
      name: 'Ana',
      login: 'ana2@escola.br',
      mustChangePassword: true,
      active: true,
    })
  })

  it('resetPassword upserts the summary and returns the new temporary password', async () => {
    vi.mocked(teacherRepository.list).mockResolvedValue([
      { id: 't-1', name: 'Bruno', login: 'bruno@escola.br', mustChangePassword: false, active: true },
    ])
    vi.mocked(teacherRepository.resetPassword).mockResolvedValue(detail())

    const store = useTeacherStore()
    await store.load()
    const result = await store.resetPassword('t-1')

    expect(result.temporaryPassword).toBe('Temp1234')
    expect(store.teachers.find((teacher) => teacher.id === 't-1')?.mustChangePassword).toBe(true)
  })

  it('setActive flips active on the teacher', async () => {
    vi.mocked(teacherRepository.list).mockResolvedValue([
      { id: 't-1', name: 'Bruno', login: 'bruno@escola.br', mustChangePassword: false, active: true },
    ])
    vi.mocked(teacherRepository.setActive).mockResolvedValue(detail({ active: false, temporaryPassword: null }))

    const store = useTeacherStore()
    await store.load()
    await store.setActive('t-1', false)

    expect(store.teachers.find((teacher) => teacher.id === 't-1')?.active).toBe(false)
    expect(teacherRepository.setActive).toHaveBeenCalledWith('t-1', false)
  })

  it('rethrows a failed create and leaves teachers untouched', async () => {
    vi.mocked(teacherRepository.list).mockResolvedValue([])
    vi.mocked(teacherRepository.create).mockRejectedValue(
      new ApiError('identity.email_already_taken', { email: 'bia@escola.br' }, 409),
    )

    const store = useTeacherStore()
    await store.load()

    await expect(store.create({ id: 't-9', name: 'Bia', email: 'bia@escola.br' })).rejects.toBeInstanceOf(ApiError)
    expect(store.teachers).toEqual([])
    // The dialog owns this failure - the list-level error stays untouched.
    expect(store.error).toBeNull()
  })

  it('reset clears the cached list and any error', async () => {
    vi.mocked(teacherRepository.list).mockRejectedValue(new ApiError('api.network_unavailable'))

    const store = useTeacherStore()
    await store.load()
    expect(store.error).not.toBeNull()

    store.reset()

    expect(store.teachers).toEqual([])
    expect(store.error).toBeNull()
  })
})
