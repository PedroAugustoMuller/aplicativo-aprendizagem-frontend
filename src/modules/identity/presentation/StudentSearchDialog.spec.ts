import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import StudentSearchDialog from '@/modules/identity/presentation/StudentSearchDialog.vue'
import { configureOffline } from '@/shared/offline/readThrough'
import { createMemoryStorage } from '@/shared/offline/storage'
import { i18n } from '@/shared/i18n'
import { ApiError } from '@/shared/api/error'
import type { StudentMatch } from '@/modules/identity/domain/Student'

const students = vi.hoisted(() => ({
  listByClassroom: vi.fn(), createMany: vi.fn(), unenrol: vi.fn(), resetPassword: vi.fn(), setActive: vi.fn(),
  credentials: vi.fn(), search: vi.fn(), enrol: vi.fn(),
}))
vi.mock('@/modules/identity/infrastructure/HttpStudentRepository', () => ({ studentRepository: students }))

const vuetify = createVuetify({ components, directives })
const CARLA: StudentMatch = { id: 's-1', name: 'Carla Dias', username: 'carla.dias', classrooms: [{ id: 'c-1', name: 'Química 1' }] }
const CAIO: StudentMatch = { id: 's-2', name: 'Caio Reis', username: 'caio.reis', classrooms: [] }

function render() {
  return mount(StudentSearchDialog, {
    props: { modelValue: true, classroomId: 'c-2' },
    global: { plugins: [vuetify, i18n] },
  })
}

async function type(wrapper: ReturnType<typeof render>, text: string) {
  await wrapper.find('[data-testid="student-search-input"] input').setValue(text)
  await vi.advanceTimersByTimeAsync(300)
  await flushPromises()
}

describe('StudentSearchDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    vi.resetAllMocks()
    configureOffline({ userId: () => 'u-1', storage: createMemoryStorage() })
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    students.listByClassroom.mockResolvedValue([])
  })

  afterEach(() => vi.useRealTimers())

  it('waits for 2 letters and a pause before searching', async () => {
    const wrapper = render()

    await type(wrapper, 'c')
    expect(students.search).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="student-search-hint"]').exists()).toBe(true)

    students.search.mockResolvedValue([CARLA])
    await wrapper.find('[data-testid="student-search-input"] input').setValue('ca')
    await wrapper.find('[data-testid="student-search-input"] input').setValue('car')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(students.search).toHaveBeenCalledTimes(1)
    expect(students.search).toHaveBeenCalledWith('car')
  })

  it('never lets a slow earlier answer replace a newer one', async () => {
    let finishFirst: (value: StudentMatch[]) => void = () => undefined
    students.search
      .mockReturnValueOnce(new Promise<StudentMatch[]>((resolve) => {
        finishFirst = resolve
      }))
      .mockResolvedValueOnce([CAIO])

    const wrapper = render()
    await type(wrapper, 'ca')
    await type(wrapper, 'cai')
    finishFirst([CARLA])
    await flushPromises()

    expect(wrapper.find('[data-testid="student-match-s-2"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="student-match-s-1"]').exists()).toBe(false)
  })

  it('marks a student who is already in this class', async () => {
    students.search.mockResolvedValue([{ ...CARLA, classrooms: [{ id: 'c-2', name: 'Biologia 1' }] }])

    const wrapper = render()
    await type(wrapper, 'carla')

    expect(wrapper.find('[data-testid="student-match-s-1"]').text()).toContain('Já está na turma')
    expect(wrapper.find('[data-testid="student-check-s-1"] input').attributes('disabled')).toBeDefined()
  })

  it('enrols the selected students and closes', async () => {
    students.search.mockResolvedValue([CARLA, CAIO])
    students.enrol.mockResolvedValue(undefined)

    const wrapper = render()
    await type(wrapper, 'ca')
    await wrapper.find('[data-testid="student-check-s-1"] input').setValue(true)
    await wrapper.find('[data-testid="student-check-s-2"] input').setValue(true)
    expect(wrapper.find('[data-testid="student-search-submit"]').text()).toContain('2')
    await wrapper.find('[data-testid="student-search-submit"]').trigger('click')
    await flushPromises()

    expect(students.enrol).toHaveBeenCalledWith('c-2', 's-1')
    expect(students.enrol).toHaveBeenCalledWith('c-2', 's-2')
    expect(wrapper.emitted('enrolled')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })

  it('names the students it could not enrol and stays open', async () => {
    students.search.mockResolvedValue([CARLA])
    students.enrol.mockRejectedValue(new ApiError('identity.classroom.enrolment_requires_active_student', {}, 422))

    const wrapper = render()
    await type(wrapper, 'carla')
    await wrapper.find('[data-testid="student-check-s-1"] input').setValue(true)
    await wrapper.find('[data-testid="student-search-submit"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="student-search-failures"]').text()).toContain('Carla Dias')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
