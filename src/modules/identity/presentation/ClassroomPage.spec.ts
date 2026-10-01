import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import ClassroomPage from '@/modules/identity/presentation/ClassroomPage.vue'
import { useSessionStore } from '@/modules/identity/application/sessionStore'
import { configureOffline } from '@/shared/offline/readThrough'
import { createMemoryStorage } from '@/shared/offline/storage'
import { i18n } from '@/shared/i18n'
import { ApiError } from '@/shared/api/error'

const students = vi.hoisted(() => ({
  listByClassroom: vi.fn(), createMany: vi.fn(), unenrol: vi.fn(), resetPassword: vi.fn(), setActive: vi.fn(), credentials: vi.fn(),
}))
const classrooms = vi.hoisted(() => ({
  list: vi.fn(), subjectOptions: vi.fn(), create: vi.fn(), update: vi.fn(), assignTeachers: vi.fn(), deactivate: vi.fn(),
}))
vi.mock('@/modules/identity/infrastructure/HttpStudentRepository', () => ({ studentRepository: students }))
vi.mock('@/modules/identity/infrastructure/HttpClassroomRepository', () => ({ classroomRepository: classrooms }))
vi.mock('@/modules/identity/infrastructure/HttpAuthRepository', () => ({
  authRepository: { login: vi.fn(), logout: vi.fn(), currentUser: vi.fn(), changePassword: vi.fn() },
}))

const vuetify = createVuetify({ components, directives })
const Stub = { render: () => null }
const App = { render: () => h(RouterView) }
const ANA = { id: 's-1', name: 'Ana Lima', username: 'ana.lima', mustChangePassword: true, active: true }

async function render() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/classrooms/:classroomId', component: ClassroomPage },
      { path: '/:any(.*)*', component: Stub },
    ],
  })
  await router.push('/classrooms/c-1')
  const wrapper = mount(App, { global: { plugins: [vuetify, i18n, router] } })
  await flushPromises()

  return { wrapper, router }
}

describe('ClassroomPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    configureOffline({ userId: () => 'u-1', storage: createMemoryStorage() })
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    useSessionStore().$patch({
      token: 'tok', user: { userId: 't-1', name: 'Bruno', login: 'b@escola.br', role: 'teacher', mustChangePassword: false },
    })
    classrooms.list.mockResolvedValue([
      { id: 'c-1', name: 'Química 1', subjectId: 's-1', teacherIds: ['t-1'], studentCount: 1, active: true },
    ])
    classrooms.subjectOptions.mockResolvedValue([{ id: 's-1', name: 'Química', active: true }])
    students.listByClassroom.mockResolvedValue([ANA])
  })

  it('shows the class and its students', async () => {
    const { wrapper } = await render()

    expect(wrapper.find('[data-testid="classroom-title"]').text()).toBe('Química 1')
    expect(wrapper.find('[data-testid="roster-student-s-1"]').text()).toContain('ana.lima')
    expect(wrapper.find('[data-testid="roster-print"]').attributes('href')).toBe('/classrooms/c-1/credentials')
  })

  it('previews a pasted list and blocks what the backend would refuse', async () => {
    const { wrapper } = await render()
    await wrapper.find('[data-testid="roster-add"]').trigger('click')
    const names = wrapper.find('[data-testid="roster-names"] textarea')

    await names.setValue('Bia\nCaio\n\nbia')
    expect(wrapper.find('[data-testid="roster-preview"]').text()).toBe('3 alunos serão criados')
    expect(wrapper.find('[data-testid="roster-duplicates"]').text()).toContain('bia')
    expect(wrapper.find('[data-testid="roster-submit"]').attributes('disabled')).toBeUndefined()

    await names.setValue(Array.from({ length: 51 }, (_, i) => `Aluno ${i}`).join('\n'))
    expect(wrapper.find('[data-testid="roster-too-many"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="roster-submit"]').attributes('disabled')).toBeDefined()
  })

  it('creates the batch with the same ids on retry, then opens the access slips', async () => {
    students.createMany.mockRejectedValueOnce(new ApiError('api.request_timeout'))
    students.createMany.mockResolvedValueOnce([])

    const { wrapper, router } = await render()
    await wrapper.find('[data-testid="roster-add"]').trigger('click')
    await wrapper.find('[data-testid="roster-names"] textarea').setValue('Bia\nCaio')
    await wrapper.find('[data-testid="roster-submit"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="roster-submit"]').trigger('click')
    await flushPromises()

    const [first, second] = students.createMany.mock.calls
    expect(first?.[1]).toEqual(second?.[1])
    expect(first?.[1]).toEqual([{ id: expect.any(String), name: 'Bia' }, { id: expect.any(String), name: 'Caio' }])
    expect(router.currentRoute.value.path).toBe('/classrooms/c-1/credentials')
  })

  it('resets a password after confirming and shows it', async () => {
    students.resetPassword.mockResolvedValue({ id: 's-1', name: 'Ana Lima', login: 'ana.lima', temporaryPassword: 'Nova2345' })

    const { wrapper } = await render()
    await wrapper.find('[data-testid="roster-reset-s-1"]').trigger('click')
    await wrapper.find('[data-testid="roster-reset-dialog-confirm"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="password-dialog-password"]').text()).toBe('Nova2345')
  })

  it('deactivates a student only after confirming', async () => {
    students.setActive.mockResolvedValue(undefined)

    const { wrapper } = await render()
    await wrapper.find('[data-testid="roster-toggle-s-1"]').trigger('click')
    expect(students.setActive).not.toHaveBeenCalled()
    await wrapper.find('[data-testid="roster-deactivate-dialog-confirm"]').trigger('click')
    await flushPromises()

    expect(students.setActive).toHaveBeenCalledWith('s-1', false)
  })

  it('removes a student from the class after confirming', async () => {
    students.unenrol.mockResolvedValue(undefined)

    const { wrapper } = await render()
    await wrapper.find('[data-testid="roster-remove-s-1"]').trigger('click')
    await wrapper.find('[data-testid="roster-remove-dialog-confirm"]').trigger('click')
    await flushPromises()

    expect(students.unenrol).toHaveBeenCalledWith('c-1', 's-1')
  })

  it('keeps the roster readable offline with changes disabled', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    const { wrapper } = await render()

    expect(wrapper.find('[data-testid="roster-student-s-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="roster-add"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="roster-remove-s-1"]').attributes('disabled')).toBeDefined()
  })

  it('explains a class the teacher does not teach', async () => {
    students.listByClassroom.mockRejectedValue(new ApiError('auth.forbidden', {}, 403))

    const { wrapper } = await render()

    expect(wrapper.find('[data-testid="roster-error"]').text()).toContain('Você não tem permissão para isso.')
  })
})
