import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import TeachersPage from '@/modules/identity/presentation/TeachersPage.vue'
import { useTeacherStore } from '@/modules/identity/application/teacherStore'
import { useSessionStore } from '@/modules/identity/application/sessionStore'
import { i18n } from '@/shared/i18n'
import { ApiError } from '@/shared/api/error'

// dependency-cruiser forbids presentation/ from reaching infrastructure/, even
// in a spec, so the repository is never imported here - the store (which
// TeachersPage actually talks to) is spied on instead, exactly like
// SubjectsPage.spec.ts does for the content module.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const vuetify = createVuetify({ components, directives })

let wrapper: VueWrapper | null = null
let store: ReturnType<typeof useTeacherStore>
let session: ReturnType<typeof useSessionStore>

// v-dialog teleports its content to document.body, outside wrapper.element,
// so lookups go through the body rather than the mounted wrapper.
const find = (selector: string) => new DOMWrapper(document.body).find(selector)

const render = (): VueWrapper => {
  wrapper = mount(TeachersPage, { attachTo: document.body, global: { plugins: [vuetify, i18n] } })
  return wrapper
}

describe('TeachersPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    store = useTeacherStore()
    session = useSessionStore()
    // The page's onMounted calls load(); replace it so tests control the
    // list through store.teachers directly instead of a real HTTP call.
    vi.spyOn(store, 'load').mockResolvedValue()
    session.user = { userId: 'admin-1', name: 'Ana', login: 'ana@escola.br', role: 'admin', mustChangePassword: false }
    store.teachers = [
      { id: 't-1', name: 'Bruno', login: 'bruno@escola.br', mustChangePassword: false, active: true },
    ]
  })

  afterEach(() => {
    i18n.global.locale.value = 'pt-BR'
    wrapper?.unmount()
    wrapper = null
  })

  it('renders a row per teacher', async () => {
    render()
    await vi.waitFor(() => expect(find('[data-testid="teachers-list"]').exists()).toBe(true))

    expect(find('[data-testid="teacher-row-t-1"]').text()).toContain('Bruno')
  })

  it('posts the typed name and email with a client-generated id, then shows the temporary password', async () => {
    const create = vi.spyOn(store, 'create').mockResolvedValue({
      id: 't-2',
      name: 'Bia',
      login: 'bia@escola.br',
      role: 'teacher',
      mustChangePassword: true,
      active: true,
      temporaryPassword: 'Temp9876',
    })

    render()
    await vi.waitFor(() => expect(find('[data-testid="teachers-list"]').exists()).toBe(true))

    await find('[data-testid="teachers-create"]').trigger('click')
    await find('[data-testid="teacher-name-input"] input').setValue('Bia')
    await find('[data-testid="teacher-email-input"] input').setValue('bia@escola.br')
    await find('[data-testid="teacher-save"]').trigger('click')
    await vi.waitFor(() => expect(create).toHaveBeenCalled())

    const [input] = create.mock.calls[0]!
    expect(input.name).toBe('Bia')
    expect(input.email).toBe('bia@escola.br')
    expect(input.id).toMatch(UUID)

    await vi.waitFor(() => expect(find('[data-testid="temporary-password-value"]').exists()).toBe(true))
    expect(find('[data-testid="temporary-password-value"]').text()).toBe('Temp9876')
  })

  it('keeps the dialog open and shows the translated conflict message on a 409', async () => {
    vi.spyOn(store, 'create').mockRejectedValue(
      new ApiError('identity.email_already_taken', { email: 'bia@escola.br' }, 409),
    )

    render()
    await vi.waitFor(() => expect(find('[data-testid="teachers-list"]').exists()).toBe(true))

    await find('[data-testid="teachers-create"]').trigger('click')
    await find('[data-testid="teacher-name-input"] input').setValue('Bia')
    await find('[data-testid="teacher-email-input"] input').setValue('bia@escola.br')
    await find('[data-testid="teacher-save"]').trigger('click')
    await vi.waitFor(() => expect(find('[data-testid="teacher-form-error"]').exists()).toBe(true))

    expect(find('[data-testid="teacher-form-error"]').text()).toBe('O e-mail bia@escola.br já está em uso.')
    expect(find('[data-testid="teacher-email-input"]').exists()).toBe(true)
  })

  it('does not offer a deactivate button on the signed-in admin\'s own row', async () => {
    store.teachers = [
      { id: 'admin-1', name: 'Ana', login: 'ana@escola.br', mustChangePassword: false, active: true },
      { id: 't-1', name: 'Bruno', login: 'bruno@escola.br', mustChangePassword: false, active: true },
    ]

    render()
    await vi.waitFor(() => expect(find('[data-testid="teachers-list"]').exists()).toBe(true))

    expect(find('[data-testid="teacher-toggle-admin-1"]').exists()).toBe(false)
    expect(find('[data-testid="teacher-toggle-t-1"]').exists()).toBe(true)
  })

  it('does not offer a reset-password button on the signed-in admin\'s own row either', async () => {
    // GET /teachers includes admins, so without this guard the school's one
    // admin could revoke their own token and force themselves into a
    // password change - "Trocar senha" in the account menu is the correct,
    // intentional way to do that for oneself.
    store.teachers = [
      { id: 'admin-1', name: 'Ana', login: 'ana@escola.br', mustChangePassword: false, active: true },
      { id: 't-1', name: 'Bruno', login: 'bruno@escola.br', mustChangePassword: false, active: true },
    ]

    render()
    await vi.waitFor(() => expect(find('[data-testid="teachers-list"]').exists()).toBe(true))

    expect(find('[data-testid="teacher-reset-admin-1"]').exists()).toBe(false)
    expect(find('[data-testid="teacher-reset-t-1"]').exists()).toBe(true)
  })
})
