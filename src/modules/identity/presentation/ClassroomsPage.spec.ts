import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import ClassroomsPage from '@/modules/identity/presentation/ClassroomsPage.vue'
import { useClassroomStore } from '@/modules/identity/application/classroomStore'
import { useSessionStore } from '@/modules/identity/application/sessionStore'
import SubjectSelect from '@/shared/ui/SubjectSelect.vue'
import { i18n } from '@/shared/i18n'
import { ApiError } from '@/shared/api/error'

// identity/ may never import another module (dependency-cruiser's
// no-cross-module-imports), so the content module's subjectStore - which
// SubjectSelect/SubjectLabel depend on - is faked through vi.mock's string
// path rather than a real import. There is nothing left in this file for the
// architecture rule to catch: the fake lives entirely inside the factory.
vi.mock('@/modules/content/application/subjectStore', () => ({
  useSubjectStore: () => ({
    activeSubjects: [{ id: 's-1', name: 'Química', active: true }],
    loading: false,
    ensureLoaded: vi.fn().mockResolvedValue(undefined),
    nameOf: (id: string) => (id === 's-1' ? 'Química' : null),
  }),
}))

// SubjectSelect wraps a v-select: rather than driving its overlay/menu (brittle
// in jsdom), the test updates it the same way Vue itself does under the hood -
// by emitting the update:modelValue event the component's defineModel relies on.
const selectSubject = async (wrapper: VueWrapper, subjectId: string): Promise<void> => {
  await wrapper.findComponent(SubjectSelect).vm.$emit('update:modelValue', subjectId)
}

// dependency-cruiser forbids presentation/ from reaching infrastructure/, even
// in a spec, so the repository is never imported here - the stores (which
// ClassroomsPage actually talks to) are spied on instead, exactly like
// TeachersPage.spec.ts does for the identity module.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const vuetify = createVuetify({ components, directives })

let wrapper: VueWrapper | null = null
let store: ReturnType<typeof useClassroomStore>
let session: ReturnType<typeof useSessionStore>

// v-dialog teleports its content to document.body, outside wrapper.element,
// so lookups go through the body rather than the mounted wrapper.
const find = (selector: string) => new DOMWrapper(document.body).find(selector)
const findAll = (selector: string) => new DOMWrapper(document.body).findAll(selector)

const render = (): VueWrapper => {
  wrapper = mount(ClassroomsPage, {
    attachTo: document.body,
    global: { plugins: [vuetify, i18n], stubs: { transition: false } },
  })
  return wrapper
}

describe('ClassroomsPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    store = useClassroomStore()
    session = useSessionStore()
    // The page's onMounted calls load(); replace it so tests control the
    // list through store.classrooms directly instead of a real HTTP call.
    vi.spyOn(store, 'load').mockResolvedValue()
    store.classrooms = [
      { id: 'c-1', name: 'Química 1', subjectId: 's-1', teacherIds: ['t-1'], studentCount: 2, active: true },
    ]
  })

  afterEach(() => {
    i18n.global.locale.value = 'pt-BR'
    wrapper?.unmount()
    wrapper = null
  })

  it('shows create, edit and assign controls to an admin', async () => {
    session.user = { userId: 'admin-1', name: 'Ana', login: 'ana@escola.br', role: 'admin', mustChangePassword: false }

    render()
    await vi.waitFor(() => expect(find('[data-testid="classrooms-list"]').exists()).toBe(true))

    expect(find('[data-testid="classrooms-create"]').exists()).toBe(true)
    expect(find('[data-testid="classroom-edit-c-1"]').exists()).toBe(true)
    expect(find('[data-testid="classroom-teachers-c-1"]').exists()).toBe(true)
    expect(find('[data-testid="classroom-deactivate-c-1"]').exists()).toBe(true)
  })

  it('hides every admin control from a teacher', async () => {
    session.user = { userId: 'te-1', name: 'Bruno', login: 'bruno@escola.br', role: 'teacher', mustChangePassword: false }

    render()
    await vi.waitFor(() => expect(find('[data-testid="classrooms-list"]').exists()).toBe(true))

    expect(findAll('[data-testid="classrooms-create"]')).toHaveLength(0)
    expect(findAll('[data-testid="classroom-edit-c-1"]')).toHaveLength(0)
    expect(findAll('[data-testid="classroom-teachers-c-1"]')).toHaveLength(0)
    expect(findAll('[data-testid="classroom-deactivate-c-1"]')).toHaveLength(0)
  })

  it('posts the typed name, subject and a client-generated id on create', async () => {
    session.user = { userId: 'admin-1', name: 'Ana', login: 'ana@escola.br', role: 'admin', mustChangePassword: false }
    const create = vi
      .spyOn(store, 'create')
      .mockResolvedValue({ id: 'whatever', name: 'Química 2', subjectId: 's-1', teacherIds: [], studentCount: 0, active: true })

    render()
    await vi.waitFor(() => expect(find('[data-testid="classrooms-list"]').exists()).toBe(true))

    await find('[data-testid="classrooms-create"]').trigger('click')
    await find('[data-testid="classroom-name-input"] input').setValue('Química 2')
    await selectSubject(wrapper!, 's-1')
    await find('[data-testid="classroom-save"]').trigger('click')
    await vi.waitFor(() => expect(create).toHaveBeenCalled())

    const [input] = create.mock.calls[0]!
    expect(input.name).toBe('Química 2')
    expect(input.subjectId).toBe('s-1')
    expect(input.id).toMatch(UUID)
  })

  it('sends the same client-generated id on a second Save after a failure', async () => {
    session.user = { userId: 'admin-1', name: 'Ana', login: 'ana@escola.br', role: 'admin', mustChangePassword: false }
    const create = vi
      .spyOn(store, 'create')
      .mockRejectedValueOnce(new ApiError('identity.classroom.name_already_taken', { name: 'Química 2' }, 409))
      .mockResolvedValueOnce({ id: 'whatever', name: 'Química 2', subjectId: 's-1', teacherIds: [], studentCount: 0, active: true })

    render()
    await vi.waitFor(() => expect(find('[data-testid="classrooms-list"]').exists()).toBe(true))

    await find('[data-testid="classrooms-create"]').trigger('click')
    await find('[data-testid="classroom-name-input"] input').setValue('Química 2')
    await selectSubject(wrapper!, 's-1')
    await find('[data-testid="classroom-save"]').trigger('click')
    await vi.waitFor(() => expect(find('[data-testid="classroom-form-error"]').exists()).toBe(true))

    await find('[data-testid="classroom-save"]').trigger('click')
    await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(2))

    const firstId = create.mock.calls[0]![0].id
    const secondId = create.mock.calls[1]![0].id
    expect(secondId).toBe(firstId)
  })

  it('shows the translated error inside the dialog on a 422 subject_inactive', async () => {
    session.user = { userId: 'admin-1', name: 'Ana', login: 'ana@escola.br', role: 'admin', mustChangePassword: false }
    vi.spyOn(store, 'create').mockRejectedValue(new ApiError('identity.classroom.subject_inactive', {}, 422))

    render()
    await vi.waitFor(() => expect(find('[data-testid="classrooms-list"]').exists()).toBe(true))

    await find('[data-testid="classrooms-create"]').trigger('click')
    await find('[data-testid="classroom-name-input"] input').setValue('Química 2')
    await selectSubject(wrapper!, 's-1')
    await find('[data-testid="classroom-save"]').trigger('click')
    await vi.waitFor(() => expect(find('[data-testid="classroom-form-error"]').exists()).toBe(true))

    expect(find('[data-testid="classroom-form-error"]').text()).toBe('Essa disciplina está desativada.')
  })
})
