import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import ClassroomsPage from '@/modules/identity/presentation/ClassroomsPage.vue'
import { useSessionStore } from '@/modules/identity/application/sessionStore'
import { configureOffline } from '@/shared/offline/readThrough'
import { createMemoryStorage } from '@/shared/offline/storage'
import { i18n } from '@/shared/i18n'

const classrooms = vi.hoisted(() => ({
  list: vi.fn(), subjectOptions: vi.fn(), create: vi.fn(), update: vi.fn(), assignTeachers: vi.fn(), deactivate: vi.fn(),
}))
const teachers = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), resetPassword: vi.fn(), setActive: vi.fn() }))
vi.mock('@/modules/identity/infrastructure/HttpClassroomRepository', () => ({ classroomRepository: classrooms }))
vi.mock('@/modules/identity/infrastructure/HttpTeacherRepository', () => ({ teacherRepository: teachers }))
vi.mock('@/modules/identity/infrastructure/HttpAuthRepository', () => ({
  authRepository: { login: vi.fn(), logout: vi.fn(), currentUser: vi.fn(), changePassword: vi.fn() },
}))

const vuetify = createVuetify({ components, directives })
const Stub = { render: () => null }
const QUIMICA_1 = { id: 'c-1', name: 'Química 1', subjectId: 's-1', teacherIds: ['t-1', 't-2'], studentCount: 2, active: true }

function signIn(role: 'admin' | 'teacher', userId: string) {
  useSessionStore().$patch({
    token: 'tok',
    user: { userId, name: 'X', login: 'x@escola.br', role, mustChangePassword: false },
  })
}

async function render() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:any(.*)*', component: Stub }] })
  await router.push('/classrooms')
  const wrapper = mount(ClassroomsPage, { global: { plugins: [vuetify, i18n, router] } })
  await flushPromises()

  return wrapper
}

describe('ClassroomsPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    configureOffline({ userId: () => 'u-1', storage: createMemoryStorage() })
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    classrooms.list.mockResolvedValue([QUIMICA_1])
    classrooms.subjectOptions.mockResolvedValue([{ id: 's-1', name: 'Química', active: true }])
    teachers.list.mockResolvedValue([
      { id: 't-1', name: 'Bruno', email: 'b@escola.br', mustChangePassword: false, active: true },
      { id: 't-2', name: 'Clara', email: 'c@escola.br', mustChangePassword: false, active: true },
    ])
  })

  it('shows an admin each class with its subject, size and teacher names', async () => {
    signIn('admin', 'a-1')

    const wrapper = await render()
    const card = wrapper.find('[data-testid="classroom-c-1"]')

    expect(card.attributes('href')).toBe('/classrooms/c-1')
    expect(card.text()).toContain('Química 1')
    expect(card.text()).toContain('Química')
    expect(card.text()).toContain('2 alunos')
    expect(card.text()).toContain('Bruno, Clara')
    expect(wrapper.find('[data-testid="classrooms-create"]').exists()).toBe(true)
  })

  it('shows a teacher "you and others" without loading the teacher list', async () => {
    signIn('teacher', 't-1')

    const wrapper = await render()

    expect(wrapper.find('[data-testid="classroom-c-1"]').text()).toContain('Você e mais 1')
    expect(teachers.list).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="classrooms-create"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="classroom-edit-c-1"]').exists()).toBe(false)
  })

  it('creates a class with a subject, reusing the id on retry', async () => {
    signIn('admin', 'a-1')
    classrooms.create.mockRejectedValueOnce(new Error('timeout'))
    classrooms.create.mockResolvedValueOnce(undefined)

    const wrapper = await render()
    await wrapper.find('[data-testid="classrooms-create"]').trigger('click')
    await wrapper.find('[data-testid="classroom-form-name"] input').setValue('Química 2')
    wrapper.findComponent({ name: 'VSelect' }).vm.$emit('update:modelValue', 's-1')
    await flushPromises()
    await wrapper.find('[data-testid="classroom-form-save"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="classroom-form-save"]').trigger('click')
    await flushPromises()

    expect(classrooms.create).toHaveBeenCalledTimes(2)
    expect(classrooms.create.mock.calls[0]?.[0]).toBe(classrooms.create.mock.calls[1]?.[0])
    expect(classrooms.create.mock.calls[0]?.[1]).toEqual({ name: 'Química 2', subjectId: 's-1' })
  })

  it('assigns teachers', async () => {
    signIn('admin', 'a-1')
    classrooms.assignTeachers.mockResolvedValue(undefined)

    const wrapper = await render()
    await wrapper.find('[data-testid="classroom-teachers-c-1"]').trigger('click')
    wrapper.findComponent({ name: 'VAutocomplete' }).vm.$emit('update:modelValue', ['t-2'])
    await flushPromises()
    await wrapper.find('[data-testid="assign-teachers-save"]').trigger('click')
    await flushPromises()

    expect(classrooms.assignTeachers).toHaveBeenCalledWith('c-1', ['t-2'])
  })

  it('asks before deactivating', async () => {
    signIn('admin', 'a-1')
    classrooms.deactivate.mockResolvedValue(undefined)

    const wrapper = await render()
    await wrapper.find('[data-testid="classroom-deactivate-c-1"]').trigger('click')
    await wrapper.find('[data-testid="classroom-deactivate-dialog-confirm"]').trigger('click')
    await flushPromises()

    expect(classrooms.deactivate).toHaveBeenCalledWith('c-1')
  })
})
