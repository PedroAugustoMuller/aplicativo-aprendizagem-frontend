import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
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
  list: vi.fn(), subjectOptions: vi.fn(), create: vi.fn(), rename: vi.fn(), replaceSubjects: vi.fn(), assignTeachers: vi.fn(), deactivate: vi.fn(),
}))
const teachers = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), resetPassword: vi.fn(), setActive: vi.fn() }))
vi.mock('@/modules/identity/infrastructure/HttpClassroomRepository', () => ({ classroomRepository: classrooms }))
vi.mock('@/modules/identity/infrastructure/HttpTeacherRepository', () => ({ teacherRepository: teachers }))
vi.mock('@/modules/identity/infrastructure/HttpAuthRepository', () => ({
  authRepository: { login: vi.fn(), logout: vi.fn(), currentUser: vi.fn(), changePassword: vi.fn() },
}))

const vuetify = createVuetify({ components, directives })
const Stub = { render: () => null }
const QUIMICA_1 = {
  id: 'c-1', name: '7º A', subjectIds: ['s-1', 's-2'], studentCount: 2, active: true,
  assignments: [{ teacherId: 't-1', subjectId: null }, { teacherId: 't-2', subjectId: 's-1' }],
}

function signIn(role: 'admin' | 'teacher', userId: string) {
  useSessionStore().$patch({
    token: 'tok',
    user: { userId, name: 'X', login: 'x@escola.br', role, mustChangePassword: false },
  })
}

/** Drives a Vuetify select by its data-testid, the way a user's pick would. */
function select(wrapper: VueWrapper, testid: string, value: unknown): void {
  const field = wrapper.findAllComponents({ name: 'VSelect' }).find((c) => c.attributes('data-testid') === testid)

  if (field === undefined) {
    throw new Error(`no select ${testid}`)
  }

  field.vm.$emit('update:modelValue', value)
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
    classrooms.subjectOptions.mockResolvedValue([{ id: 's-1', name: 'Química', active: true }, { id: 's-2', name: 'Biologia', active: true }])
    teachers.list.mockResolvedValue([
      { id: 't-1', name: 'Bruno', email: 'b@escola.br', mustChangePassword: false, active: true },
      { id: 't-2', name: 'Clara', email: 'c@escola.br', mustChangePassword: false, active: true },
      { id: 't-3', name: 'Dora', email: 'd@escola.br', mustChangePassword: false, active: true },
    ])
  })

  it('shows an admin each class with its subject, size and teacher names', async () => {
    signIn('admin', 'a-1')

    const wrapper = await render()
    const card = wrapper.find('[data-testid="classroom-c-1"]')

    expect(card.attributes('href')).toBe('/classrooms/c-1')
    expect(card.text()).toContain('7º A')
    expect(card.text()).toContain('Química · Biologia')
    expect(card.text()).toContain('2 alunos')
    expect(card.text()).toContain('Bruno (Turma toda), Clara (Química)')
    expect(wrapper.find('[data-testid="classrooms-create"]').exists()).toBe(true)
  })

  it('shows a teacher "you and others" without loading the teacher list', async () => {
    signIn('teacher', 't-1')

    const wrapper = await render()

    expect(wrapper.find('[data-testid="classroom-c-1"]').text()).toContain('Você · Turma toda e mais 1')
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
    select(wrapper, 'classroom-form-subjects', ['s-1', 's-2'])
    await flushPromises()
    await wrapper.find('[data-testid="classroom-form-save"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="classroom-form-save"]').trigger('click')
    await flushPromises()

    expect(classrooms.create).toHaveBeenCalledTimes(2)
    expect(classrooms.create.mock.calls[0]?.[0]).toBe(classrooms.create.mock.calls[1]?.[0])
    expect(classrooms.create.mock.calls[0]?.[1]).toEqual({ name: 'Química 2', subjectIds: ['s-1', 's-2'] })
  })

  it('shows a subject teacher their own scope', async () => {
    signIn('teacher', 't-2')

    const wrapper = await render()

    expect(wrapper.find('[data-testid="classroom-c-1"]').text()).toContain('Você · Química e mais 1')
  })

  it('renames a class without touching its subjects', async () => {
    signIn('admin', 'a-1')
    classrooms.rename.mockResolvedValue(undefined)

    const wrapper = await render()
    await wrapper.find('[data-testid="classroom-edit-c-1"]').trigger('click')
    expect(wrapper.find('[data-testid="classroom-form-subjects"]').exists()).toBe(false)
    await wrapper.find('[data-testid="classroom-form-name"] input').setValue('7º B')
    await wrapper.find('[data-testid="classroom-form-save"]').trigger('click')
    await flushPromises()

    expect(classrooms.rename).toHaveBeenCalledWith('c-1', '7º B')
  })

  it('warns which assignments a removed subject takes with it, then saves the list', async () => {
    signIn('admin', 'a-1')
    classrooms.replaceSubjects.mockResolvedValue(undefined)

    const wrapper = await render()
    await wrapper.find('[data-testid="classroom-subjects-c-1"]').trigger('click')
    expect(wrapper.find('[data-testid="classroom-subjects-warning"]').exists()).toBe(false)
    select(wrapper, 'classroom-subjects-select', ['s-2'])
    await flushPromises()

    expect(wrapper.find('[data-testid="classroom-subjects-warning"]').text()).toContain('Clara (Química)')
    await wrapper.find('[data-testid="classroom-subjects-save"]').trigger('click')
    await flushPromises()
    expect(classrooms.replaceSubjects).toHaveBeenCalledWith('c-1', ['s-2'])
  })

  it('assigns teachers as rows of teacher and scope', async () => {
    signIn('admin', 'a-1')
    classrooms.assignTeachers.mockResolvedValue(undefined)

    const wrapper = await render()
    await wrapper.find('[data-testid="classroom-teachers-c-1"]').trigger('click')
    expect(wrapper.find('[data-testid="assign-row-1-teacher"]').exists()).toBe(true)
    await wrapper.find('[data-testid="assign-add"]').trigger('click')
    select(wrapper, 'assign-row-2-teacher', 't-3')
    select(wrapper, 'assign-row-2-scope', 's-2')
    await flushPromises()
    await wrapper.find('[data-testid="assign-teachers-save"]').trigger('click')
    await flushPromises()

    expect(classrooms.assignTeachers).toHaveBeenCalledWith('c-1', [
      { teacherId: 't-1', subjectId: null },
      { teacherId: 't-2', subjectId: 's-1' },
      { teacherId: 't-3', subjectId: 's-2' },
    ])
  })

  it('blocks a teacher who is both whole-class and per-subject', async () => {
    signIn('admin', 'a-1')

    const wrapper = await render()
    await wrapper.find('[data-testid="classroom-teachers-c-1"]').trigger('click')
    select(wrapper, 'assign-row-1-teacher', 't-1')
    await flushPromises()

    expect(wrapper.find('[data-testid="assign-redundant"]').text()).toContain('Bruno')
    expect(wrapper.find('[data-testid="assign-teachers-save"]').attributes('disabled')).toBeDefined()
  })

  it('blocks the same assignment twice with a message naming the teacher', async () => {
    signIn('admin', 'a-1')

    const wrapper = await render()
    await wrapper.find('[data-testid="classroom-teachers-c-1"]').trigger('click')
    await wrapper.find('[data-testid="assign-add"]').trigger('click')
    select(wrapper, 'assign-row-2-teacher', 't-2')
    select(wrapper, 'assign-row-2-scope', 's-1')
    await flushPromises()

    expect(wrapper.find('[data-testid="assign-duplicate"]').text()).toContain('Clara')
    expect(wrapper.find('[data-testid="assign-teachers-save"]').attributes('disabled')).toBeDefined()
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
