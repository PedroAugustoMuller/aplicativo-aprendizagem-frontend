import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import LoginPage from '@/modules/identity/presentation/LoginPage.vue'
import { useSessionStore } from '@/modules/identity/application/sessionStore'
import { i18n } from '@/shared/i18n'
import { ApiError } from '@/shared/api/error'

vi.mock('@/modules/identity/infrastructure/HttpAuthRepository', () => ({
  authRepository: { login: vi.fn(), logout: vi.fn(), currentUser: vi.fn() },
}))

const push = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => ({ query: {} }),
}))

const vuetify = createVuetify({ components, directives })

const render = () => mount(LoginPage, { global: { plugins: [vuetify, i18n] } })

describe('LoginPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    i18n.global.locale.value = 'pt-BR'
  })

  it('submits the typed credentials', async () => {
    const store = useSessionStore()
    const login = vi.spyOn(store, 'login').mockResolvedValue()

    const wrapper = render()
    await wrapper.find('[data-testid="login-email"] input').setValue('ana@escola.br')
    await wrapper.find('[data-testid="login-password"] input').setValue('password')
    await wrapper.find('[data-testid="login-submit"]').trigger('click')
    await vi.waitFor(() => expect(login).toHaveBeenCalled())

    expect(login).toHaveBeenCalledWith({ email: 'ana@escola.br', password: 'password' })
  })

  it('shows the translated message for a rejected login', async () => {
    const store = useSessionStore()
    vi.spyOn(store, 'login').mockRejectedValue(new ApiError('identity.invalid_credentials', {}, 401))

    const wrapper = render()
    await wrapper.find('[data-testid="login-email"] input').setValue('ana@escola.br')
    await wrapper.find('[data-testid="login-password"] input').setValue('wrong')
    await wrapper.find('[data-testid="login-submit"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('[data-testid="login-error"]').exists()).toBe(true))

    expect(wrapper.find('[data-testid="login-error"]').text()).toBe('E-mail ou senha incorretos.')
  })

  it('re-renders the current error when the language changes', async () => {
    // The page keeps the ApiError, not a translated string, like topicStore does.
    const store = useSessionStore()
    vi.spyOn(store, 'login').mockRejectedValue(new ApiError('identity.invalid_credentials', {}, 401))

    const wrapper = render()
    await wrapper.find('[data-testid="login-submit"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('[data-testid="login-error"]').exists()).toBe(true))

    i18n.global.locale.value = 'en'
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="login-error"]').text()).toBe('Incorrect email or password.'),
    )
  })

  it('shows a usable message when the network is down', async () => {
    const store = useSessionStore()
    vi.spyOn(store, 'login').mockRejectedValue(new ApiError('api.network_unavailable'))

    const wrapper = render()
    await wrapper.find('[data-testid="login-submit"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('[data-testid="login-error"]').exists()).toBe(true))

    expect(wrapper.find('[data-testid="login-error"]').text()).toContain('Sem conexão')
  })

  it('navigates to the topics page after a successful login', async () => {
    const store = useSessionStore()
    vi.spyOn(store, 'login').mockResolvedValue()

    const wrapper = render()
    await wrapper.find('[data-testid="login-submit"]').trigger('click')
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/topics'))
  })
})
