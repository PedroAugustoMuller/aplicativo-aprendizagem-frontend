import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import ChangePasswordPage from '@/modules/identity/presentation/ChangePasswordPage.vue'
import { useSessionStore } from '@/modules/identity/application/sessionStore'
import { i18n } from '@/shared/i18n'
import { ApiError } from '@/shared/api/error'

vi.mock('@/modules/identity/infrastructure/HttpAuthRepository', () => ({
  authRepository: { login: vi.fn(), logout: vi.fn(), currentUser: vi.fn(), changePassword: vi.fn() },
}))

const push = vi.fn()
const route: { query: Record<string, string> } = { query: {} }
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => route,
}))

const vuetify = createVuetify({ components, directives })

const DIEGO = {
  userId: 'u-13', name: 'Diego Souza', login: 'diego.souza', role: 'student', mustChangePassword: true,
} as const

function render() {
  return mount(ChangePasswordPage, { global: { plugins: [vuetify, i18n] } })
}

async function fill(wrapper: ReturnType<typeof render>, current: string, next: string, confirmation: string) {
  await wrapper.find('[data-testid="password-current"] input').setValue(current)
  await wrapper.find('[data-testid="password-new"] input').setValue(next)
  await wrapper.find('[data-testid="password-confirm"] input').setValue(confirmation)
}

describe('ChangePasswordPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    route.query = {}
    useSessionStore().$patch({ token: 'tok', user: { ...DIEGO } })
  })

  it('explains why the page appeared when a change is required', () => {
    expect(render().find('[data-testid="password-required"]').text())
      .toBe('Crie uma nova senha para continuar.')
  })

  it('sends the change and continues to the subjects', async () => {
    const change = vi.spyOn(useSessionStore(), 'changePassword').mockResolvedValue()

    const wrapper = render()
    await fill(wrapper, 'Temp2345', 'nova-senha-1', 'nova-senha-1')
    await wrapper.find('[data-testid="password-submit"]').trigger('click')
    await flushPromises()

    expect(change).toHaveBeenCalledWith({ currentPassword: 'Temp2345', newPassword: 'nova-senha-1' })
    expect(push).toHaveBeenCalledWith('/subjects')
  })

  it('continues to where the user was going', async () => {
    route.query = { redirect: '/subjects/s-1/topics' }
    vi.spyOn(useSessionStore(), 'changePassword').mockResolvedValue()

    const wrapper = render()
    await fill(wrapper, 'Temp2345', 'nova-senha-1', 'nova-senha-1')
    await wrapper.find('[data-testid="password-submit"]').trigger('click')
    await flushPromises()

    expect(push).toHaveBeenCalledWith('/subjects/s-1/topics')
  })

  it('refuses a new password shorter than 8 characters without calling the server', async () => {
    const change = vi.spyOn(useSessionStore(), 'changePassword')

    const wrapper = render()
    await fill(wrapper, 'Temp2345', 'curta', 'curta')
    await wrapper.find('[data-testid="password-submit"]').trigger('click')
    await flushPromises()

    expect(change).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="password-new"]').text())
      .toContain('A nova senha precisa ter pelo menos 8 caracteres.')
  })

  it('refuses a confirmation that does not match without calling the server', async () => {
    const change = vi.spyOn(useSessionStore(), 'changePassword')

    const wrapper = render()
    await fill(wrapper, 'Temp2345', 'nova-senha-1', 'nova-senha-2')
    await wrapper.find('[data-testid="password-submit"]').trigger('click')
    await flushPromises()

    expect(change).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="password-confirm"]').text()).toContain('As senhas não conferem.')
  })

  it('shows a wrong current password as a translated message', async () => {
    vi.spyOn(useSessionStore(), 'changePassword')
      .mockRejectedValue(new ApiError('identity.current_password_invalid', {}, 422))

    const wrapper = render()
    await fill(wrapper, 'errada', 'nova-senha-1', 'nova-senha-1')
    await wrapper.find('[data-testid="password-submit"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="password-error"]').text()).toBe('A senha atual está incorreta.')
    expect(push).not.toHaveBeenCalled()
  })

  it('puts field-level server errors under the matching field', async () => {
    vi.spyOn(useSessionStore(), 'changePassword').mockRejectedValue(
      new ApiError('validation.failed', {}, 422, undefined, {
        new_password: [{ code: 'validation.different', params: {} }],
      }),
    )

    const wrapper = render()
    await fill(wrapper, 'Temp2345', 'Temp2345', 'Temp2345')
    await wrapper.find('[data-testid="password-submit"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="password-new"]').text())
      .toContain('A nova senha precisa ser diferente da atual.')
    expect(wrapper.find('[data-testid="password-error"]').text()).toBe('Confira os campos destacados.')
  })

  it('sends exactly one request when the button is hit twice', async () => {
    let finish: () => void = () => undefined
    const change = vi.spyOn(useSessionStore(), 'changePassword').mockImplementation(
      () => new Promise<void>((resolve) => {
        finish = resolve
      }),
    )

    const wrapper = render()
    await fill(wrapper, 'Temp2345', 'nova-senha-1', 'nova-senha-1')
    await wrapper.find('[data-testid="password-submit"]').trigger('click')
    await wrapper.find('[data-testid="password-submit"]').trigger('click')
    await wrapper.find('form').trigger('submit')
    finish()
    await flushPromises()

    expect(change).toHaveBeenCalledTimes(1)
  })
})
