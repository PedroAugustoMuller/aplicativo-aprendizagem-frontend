import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import TeachersPage from '@/modules/identity/presentation/TeachersPage.vue'
import { configureOffline } from '@/shared/offline/readThrough'
import { createMemoryStorage } from '@/shared/offline/storage'
import { i18n } from '@/shared/i18n'
import { ApiError } from '@/shared/api/error'

const repo = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), resetPassword: vi.fn(), setActive: vi.fn() }))
vi.mock('@/modules/identity/infrastructure/HttpTeacherRepository', () => ({ teacherRepository: repo }))

const vuetify = createVuetify({ components, directives })
const BRUNO = { id: 't-1', name: 'Bruno', email: 'bruno@escola.br', mustChangePassword: true, active: true }
const ISSUED = { id: 't-2', name: 'Clara', login: 'clara@escola.br', temporaryPassword: 'Xyz34567' }

async function render() {
  const wrapper = mount(TeachersPage, { global: { plugins: [vuetify, i18n] } })
  await flushPromises()

  return wrapper
}

describe('TeachersPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    configureOffline({ userId: () => 'u-1', storage: createMemoryStorage() })
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    repo.list.mockResolvedValue([BRUNO])
  })

  it('lists teachers with their status', async () => {
    const wrapper = await render()

    const row = wrapper.find('[data-testid="teacher-t-1"]')
    expect(row.text()).toContain('Bruno')
    expect(row.text()).toContain('bruno@escola.br')
    expect(row.text()).toContain('Senha provisória')
  })

  it('creates a teacher and shows the temporary password once', async () => {
    repo.create.mockResolvedValue(ISSUED)

    const wrapper = await render()
    await wrapper.find('[data-testid="teachers-create"]').trigger('click')
    await wrapper.find('[data-testid="teacher-form-name"] input').setValue('Clara')
    await wrapper.find('[data-testid="teacher-form-email"] input').setValue('clara@escola.br')
    await wrapper.find('[data-testid="teacher-form-save"]').trigger('click')
    await flushPromises()

    expect(repo.create).toHaveBeenCalledWith({ id: expect.any(String), name: 'Clara', email: 'clara@escola.br' })
    expect(wrapper.find('[data-testid="password-dialog-password"]').text()).toBe('Xyz34567')
  })

  it('shows the email-taken error inside the form', async () => {
    repo.create.mockRejectedValue(new ApiError('identity.email_already_taken', {}, 409))

    const wrapper = await render()
    await wrapper.find('[data-testid="teachers-create"]').trigger('click')
    await wrapper.find('[data-testid="teacher-form-name"] input').setValue('Clara')
    await wrapper.find('[data-testid="teacher-form-email"] input').setValue('bruno@escola.br')
    await wrapper.find('[data-testid="teacher-form-save"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="teacher-form-error"]').text()).toBe('Este e-mail já está em uso.')
  })

  it('resets a password after confirming', async () => {
    repo.resetPassword.mockResolvedValue({ ...ISSUED, id: 't-1', name: 'Bruno' })

    const wrapper = await render()
    await wrapper.find('[data-testid="teacher-reset-t-1"]').trigger('click')
    await wrapper.find('[data-testid="teacher-reset-dialog-confirm"]').trigger('click')
    await flushPromises()

    expect(repo.resetPassword).toHaveBeenCalledWith('t-1')
    expect(wrapper.find('[data-testid="password-dialog-password"]').text()).toBe('Xyz34567')
  })

  it('deactivates after confirming', async () => {
    repo.setActive.mockResolvedValue(undefined)

    const wrapper = await render()
    await wrapper.find('[data-testid="teacher-toggle-t-1"]').trigger('click')
    expect(repo.setActive).not.toHaveBeenCalled()
    await wrapper.find('[data-testid="teacher-deactivate-dialog-confirm"]').trigger('click')
    await flushPromises()

    expect(repo.setActive).toHaveBeenCalledWith('t-1', false)
  })

  it('reactivates an inactive teacher without asking', async () => {
    repo.list.mockResolvedValue([{ ...BRUNO, active: false }])
    repo.setActive.mockResolvedValue(undefined)

    const wrapper = await render()
    await wrapper.find('[data-testid="teacher-toggle-t-1"]').trigger('click')
    await flushPromises()

    expect(repo.setActive).toHaveBeenCalledWith('t-1', true)
  })

  it('disables every change while offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    const wrapper = await render()

    expect(wrapper.find('[data-testid="teachers-create"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="teacher-reset-t-1"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="teacher-toggle-t-1"]').attributes('disabled')).toBeDefined()
  })
})
