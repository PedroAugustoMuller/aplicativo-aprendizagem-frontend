import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import SubjectsPage from '@/modules/content/presentation/SubjectsPage.vue'
import { i18n } from '@/shared/i18n'
import { ApiError } from '@/shared/api/error'
import { configureOffline } from '@/shared/offline/readThrough'
import { configureViewer } from '@/shared/auth/viewer'
import { createMemoryStorage, type OfflineStorage } from '@/shared/offline/storage'

const { list, create, rename, deactivate } = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  rename: vi.fn(),
  deactivate: vi.fn(),
}))

vi.mock('@/modules/content/infrastructure/HttpSubjectRepository', () => ({
  subjectRepository: { list, create, rename, deactivate },
}))

const vuetify = createVuetify({ components, directives })
let storage: OfflineStorage
const Stub = defineComponent({ render: () => null })

async function render() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/subjects', component: Stub },
      { path: '/subjects/:subjectId/topics', component: Stub },
    ],
  })
  await router.push('/subjects')

  const wrapper = mount(SubjectsPage, { global: { plugins: [vuetify, i18n, router] } })
  await flushPromises()

  return { wrapper, router }
}

describe('SubjectsPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    storage = createMemoryStorage()
    configureOffline({ userId: () => 'u-1', storage })
    configureViewer(() => 'admin')
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })

  it('lists the subjects, each linking to its topics', async () => {
    list.mockResolvedValue([{ id: 's-1', name: 'Química', active: true }])

    const { wrapper } = await render()

    const card = wrapper.find('[data-testid="subject-s-1"]')
    expect(card.text()).toContain('Química')
    expect(card.attributes('href')).toBe('/subjects/s-1/topics')
    expect(wrapper.find('[data-testid="subject-inactive"]').exists()).toBe(false)
  })

  it('marks an inactive subject', async () => {
    list.mockResolvedValue([{ id: 's-2', name: 'Biologia', active: false }])

    const { wrapper } = await render()

    expect(wrapper.find('[data-testid="subject-s-2"] [data-testid="subject-inactive"]').text()).toBe('Inativa')
  })

  it('says so when there are no subjects', async () => {
    list.mockResolvedValue([])

    const { wrapper } = await render()

    expect(wrapper.find('[data-testid="subjects-empty"]').text()).toContain('Nenhuma matéria disponível ainda.')
  })

  it('shows a translated error and recovers on retry', async () => {
    list.mockRejectedValueOnce(new ApiError('api.network_unavailable'))
    list.mockResolvedValueOnce([{ id: 's-1', name: 'Química', active: true }])

    const { wrapper } = await render()
    expect(wrapper.find('[data-testid="subjects-error"]').text()).toContain('Sem conexão')

    await wrapper.find('[data-testid="subjects-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="subjects-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="subjects-list"]').exists()).toBe(true)
  })

  it('shows the saved subjects with a banner while offline', async () => {
    await storage.set('u-1:content:subjects', {
      value: [{ id: 's-1', name: 'Química', active: true }],
      savedAt: new Date(2026, 8, 30, 12, 40).toISOString(),
    })
    list.mockRejectedValue(new ApiError('api.network_unavailable'))

    const { wrapper } = await render()

    expect(wrapper.find('[data-testid="subject-s-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="offline-banner"]').text()).toContain('12:40')
  })

  it('lets an admin create a subject, keeping the same id when retrying', async () => {
    list.mockResolvedValue([])
    create.mockRejectedValueOnce(new ApiError('api.request_timeout'))
    create.mockResolvedValueOnce({ id: 'x', name: 'Física', active: true })

    const { wrapper } = await render()
    await wrapper.find('[data-testid="subjects-create"]').trigger('click')
    await wrapper.find('[data-testid="subject-form-name"] input').setValue(' Física ')
    await wrapper.find('[data-testid="subject-form-save"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="subject-form-error"]').exists()).toBe(true)

    await wrapper.find('[data-testid="subject-form-save"]').trigger('click')
    await flushPromises()

    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls[0]?.[0]).toEqual(create.mock.calls[1]?.[0])
    expect(create.mock.calls[0]?.[0]).toMatchObject({ name: 'Física' })
    expect(wrapper.find('[data-testid="subject-form"]').exists()).toBe(false)
  })

  it('asks before deactivating', async () => {
    list.mockResolvedValue([{ id: 's-1', name: 'Química', active: true }])
    deactivate.mockResolvedValue({ id: 's-1', name: 'Química', active: false })

    const { wrapper } = await render()
    await wrapper.find('[data-testid="subject-deactivate-s-1"]').trigger('click')
    expect(deactivate).not.toHaveBeenCalled()
    await wrapper.find('[data-testid="subject-deactivate-dialog-confirm"]').trigger('click')
    await flushPromises()

    expect(deactivate).toHaveBeenCalledWith('s-1')
  })

  it('hides management from teachers and students', async () => {
    configureViewer(() => 'teacher')
    list.mockResolvedValue([{ id: 's-1', name: 'Química', active: true }])

    const { wrapper } = await render()

    expect(wrapper.find('[data-testid="subjects-create"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="subject-rename-s-1"]').exists()).toBe(false)
  })

  it('disables changes while offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    list.mockResolvedValue([{ id: 's-1', name: 'Química', active: true }])

    const { wrapper } = await render()

    expect(wrapper.find('[data-testid="subjects-create"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="subject-rename-s-1"]').attributes('disabled')).toBeDefined()
  })
})
