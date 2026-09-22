import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import ChangePasswordPage from '@/modules/identity/presentation/ChangePasswordPage.vue'
import { useSessionStore } from '@/modules/identity/application/sessionStore'
import { i18n } from '@/shared/i18n'
import { ApiError } from '@/shared/api/error'

// presentation/ never imports infrastructure/ (dependency-cruiser), so mock the
// repository by path, exactly as LoginPage.spec.ts and guard.spec.ts do.
vi.mock('@/modules/identity/infrastructure/HttpAuthRepository', () => ({
  authRepository: { login: vi.fn(), logout: vi.fn(), currentUser: vi.fn(), changePassword: vi.fn() },
}))

const vuetify = createVuetify({ components, directives })
const Stub = { render: () => null }

function buildRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/change-password', component: ChangePasswordPage },
      { path: '/classrooms', component: Stub },
      { path: '/my-classrooms', component: Stub },
    ],
  })
}

async function render(router: Router = buildRouter()) {
  await router.push('/change-password')
  const wrapper = mount(ChangePasswordPage, { global: { plugins: [vuetify, i18n, router] } })
  return { wrapper, router }
}

describe('ChangePasswordPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    i18n.global.locale.value = 'pt-BR'
  })

  it('shows the forced notice when the session has a pending password change', async () => {
    const store = useSessionStore()
    store.user = { userId: 'u-2', name: 'Diego', login: 'diego.souza', role: 'student', mustChangePassword: true }

    const { wrapper } = await render()

    expect(wrapper.find('[data-testid="password-forced-notice"]').exists()).toBe(true)
  })

  it('does not show the forced notice for a voluntary visit', async () => {
    const store = useSessionStore()
    store.user = { userId: 'u-1', name: 'Ana', login: 'ana@escola.br', role: 'admin', mustChangePassword: false }

    const { wrapper } = await render()

    expect(wrapper.find('[data-testid="password-forced-notice"]').exists()).toBe(false)
  })

  it('disables submit and shows the length error for a new password shorter than 8 characters', async () => {
    const store = useSessionStore()
    store.user = { userId: 'u-2', name: 'Diego', login: 'diego.souza', role: 'student', mustChangePassword: true }
    const changePassword = vi.spyOn(store, 'changePassword')

    const { wrapper } = await render()
    await wrapper.find('[data-testid="password-current"] input').setValue('Temp2345')
    await wrapper.find('[data-testid="password-new"] input').setValue('short')
    await wrapper.find('[data-testid="password-confirm"] input').setValue('short')
    await wrapper.find('[data-testid="password-submit"]').trigger('click')

    expect(wrapper.text()).toContain('Use pelo menos 8 caracteres.')
    expect(wrapper.find('[data-testid="password-submit"]').attributes('disabled')).toBeDefined()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('disables submit and shows the mismatch error when confirmation differs from the new password', async () => {
    const store = useSessionStore()
    store.user = { userId: 'u-2', name: 'Diego', login: 'diego.souza', role: 'student', mustChangePassword: true }
    const changePassword = vi.spyOn(store, 'changePassword')

    const { wrapper } = await render()
    await wrapper.find('[data-testid="password-current"] input').setValue('Temp2345')
    await wrapper.find('[data-testid="password-new"] input').setValue('longenough1')
    await wrapper.find('[data-testid="password-confirm"] input').setValue('somethingElse')
    await wrapper.find('[data-testid="password-submit"]').trigger('click')

    expect(wrapper.text()).toContain('As senhas não conferem.')
    expect(wrapper.find('[data-testid="password-submit"]').attributes('disabled')).toBeDefined()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('submits the change and lands a student on their home', async () => {
    const store = useSessionStore()
    store.user = { userId: 'u-2', name: 'Diego', login: 'diego.souza', role: 'student', mustChangePassword: true }
    const changePassword = vi.spyOn(store, 'changePassword').mockResolvedValue()

    const { wrapper, router } = await render()
    await wrapper.find('[data-testid="password-current"] input').setValue('Temp2345')
    await wrapper.find('[data-testid="password-new"] input').setValue('minha-senha')
    await wrapper.find('[data-testid="password-confirm"] input').setValue('minha-senha')
    await wrapper.find('[data-testid="password-submit"]').trigger('click')

    await vi.waitFor(() => expect(changePassword).toHaveBeenCalled())
    expect(changePassword).toHaveBeenCalledWith({ currentPassword: 'Temp2345', newPassword: 'minha-senha' })
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/my-classrooms'))
  })

  it('shows the translated message when the current password is rejected', async () => {
    const store = useSessionStore()
    store.user = { userId: 'u-2', name: 'Diego', login: 'diego.souza', role: 'student', mustChangePassword: true }
    vi.spyOn(store, 'changePassword').mockRejectedValue(new ApiError('identity.current_password_invalid', {}, 422))

    const { wrapper } = await render()
    await wrapper.find('[data-testid="password-current"] input').setValue('wrong')
    await wrapper.find('[data-testid="password-new"] input').setValue('minha-senha')
    await wrapper.find('[data-testid="password-confirm"] input').setValue('minha-senha')
    await wrapper.find('[data-testid="password-submit"]').trigger('click')

    await vi.waitFor(() => expect(wrapper.find('[data-testid="password-error"]').exists()).toBe(true))
    expect(wrapper.find('[data-testid="password-error"]').text()).toBe('A senha atual está incorreta.')
  })
})
