import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h, type VNode } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import TopicsPage from '@/modules/content/presentation/TopicsPage.vue'
import type { Topic } from '@/modules/content/domain/Topic'
import { i18n } from '@/shared/i18n'
import { ApiError } from '@/shared/api/error'
import { configureOffline } from '@/shared/offline/readThrough'
import { createMemoryStorage, type OfflineStorage } from '@/shared/offline/storage'

const { listSubjects, listBySubject, create, update, deactivate, reactivate, reorder } = vi.hoisted(() => ({ listSubjects: vi.fn(), listBySubject: vi.fn(), create: vi.fn(), update: vi.fn(), deactivate: vi.fn(), reactivate: vi.fn(), reorder: vi.fn() }))

vi.mock('@/modules/content/infrastructure/HttpSubjectRepository', () => ({
  subjectRepository: { list: listSubjects },
}))
vi.mock('@/modules/content/infrastructure/HttpTopicRepository', () => ({
  topicRepository: { listBySubject, create, update, deactivate, reactivate, reorder },
}))

const vuetify = createVuetify({ components, directives })
// Plain component objects: a stand-in route and a RouterView host for the page.
const Stub = { render: () => null }
const App = { render: () => h(RouterView) }

const SUBJECTS = [
  { id: 's-1', name: 'Química', active: true, canAuthor: false },
  { id: 's-2', name: 'Biologia', active: true, canAuthor: false },
]

async function render(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/subjects', component: Stub },
      { path: '/subjects/:subjectId/topics', component: TopicsPage },
      { path: '/subjects/:subjectId/topics/:topicId/questions', component: Stub },
    ],
  })
  await router.push(path)

  const wrapper = mount(App, { global: { plugins: [vuetify, i18n, router] } })
  await flushPromises()

  return { wrapper, router }
}

describe('TopicsPage', () => {
  let storage: OfflineStorage

  beforeEach(() => {
    storage = createMemoryStorage()
    configureOffline({ userId: () => 'u-1', storage })
    setActivePinia(createPinia())
    vi.resetAllMocks()
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    listSubjects.mockResolvedValue(SUBJECTS)
  })

  it('titles the page with the subject and lists its topics', async () => {
    listBySubject.mockResolvedValue([{ id: 't-1', name: 'Átomos', description: 'x', position: 1 }])

    const { wrapper } = await render('/subjects/s-1/topics')

    expect(listBySubject).toHaveBeenCalledWith('s-1')
    expect(wrapper.find('[data-testid="topics-title"]').text()).toBe('Química')
    expect(wrapper.find('[data-testid="topic-t-1"]').text()).toContain('Átomos')
  })

  it('falls back to a generic title when the subject list is unavailable', async () => {
    listSubjects.mockRejectedValue(new ApiError('api.network_unavailable'))
    listBySubject.mockResolvedValue([])

    const { wrapper } = await render('/subjects/s-1/topics')

    expect(wrapper.find('[data-testid="topics-title"]').text()).toBe('Conteúdos')
    expect(wrapper.find('[data-testid="topics-empty"]').exists()).toBe(true)
  })

  it('links back to the subjects', async () => {
    listBySubject.mockResolvedValue([])

    const { wrapper } = await render('/subjects/s-1/topics')

    expect(wrapper.find('[data-testid="topics-back"]').attributes('href')).toBe('/subjects')
  })

  it('reloads for the new subject when only the route param changes', async () => {
    listBySubject.mockResolvedValueOnce([{ id: 't-1', name: 'Átomos', description: 'x', position: 1 }])
    listBySubject.mockResolvedValueOnce([{ id: 't-9', name: 'Células', description: 'y', position: 1 }])

    const { wrapper, router } = await render('/subjects/s-1/topics')
    await router.push('/subjects/s-2/topics')
    await flushPromises()

    expect(listBySubject).toHaveBeenLastCalledWith('s-2')
    expect(wrapper.find('[data-testid="topics-title"]').text()).toBe('Biologia')
    expect(wrapper.find('[data-testid="topic-t-1"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="topic-t-9"]').exists()).toBe(true)
  })

  it('explains a subject the student is not enrolled in', async () => {
    listBySubject.mockRejectedValue(new ApiError('auth.forbidden', {}, 403))

    const { wrapper } = await render('/subjects/s-1/topics')

    expect(wrapper.find('[data-testid="topics-error"]').text()).toContain('Você não tem permissão para isso.')
  })

  it('tells a user who still has a temporary password what to do', async () => {
    // After an offline reload the guard cannot know yet; the page must still speak plainly.
    listBySubject.mockRejectedValue(new ApiError('identity.password_change_required', {}, 403))

    const { wrapper } = await render('/subjects/s-1/topics')

    expect(wrapper.find('[data-testid="topics-error"]').text())
      .toContain('Você precisa trocar sua senha antes de continuar.')
    expect(wrapper.find('[data-testid="topics-change-password"]').exists()).toBe(true)
  })

  it('retries the same subject', async () => {
    listBySubject.mockRejectedValueOnce(new ApiError('api.network_unavailable'))
    listBySubject.mockResolvedValueOnce([{ id: 't-1', name: 'Átomos', description: 'x', position: 1 }])

    const { wrapper } = await render('/subjects/s-1/topics')
    await wrapper.find('[data-testid="topics-retry"]').trigger('click')
    await flushPromises()

    expect(listBySubject).toHaveBeenLastCalledWith('s-1')
    expect(wrapper.find('[data-testid="topics-list"]').exists()).toBe(true)
  })

  describe('for an author', () => {
    const ATOMS = { id: 't-1', name: 'Átomos', description: 'x', position: 0, active: true, questionCount: 3 }
    const IONS = { id: 't-2', name: 'Íons', description: '', position: 1, active: false, questionCount: 0 }

    beforeEach(() => {
      listSubjects.mockResolvedValue([{ id: 's-1', name: 'Química', active: true, canAuthor: true }])
    })

    it('shows counts, the inactive mark, and links each card to its questions', async () => {
      listBySubject.mockResolvedValue([ATOMS, IONS])

      const { wrapper } = await render('/subjects/s-1/topics')

      expect(wrapper.find('[data-testid="topic-t-1"]').attributes('href')).toBe('/subjects/s-1/topics/t-1/questions')
      expect(wrapper.find('[data-testid="topic-t-1"] [data-testid="topic-question-count"]').text()).toBe('3 questões')
      expect(wrapper.find('[data-testid="topic-t-2"] [data-testid="topic-question-count"]').text()).toBe('Sem questões')
      expect(wrapper.find('[data-testid="topic-t-2"] [data-testid="topic-inactive"]').text()).toBe('Desativado')
      expect(wrapper.find('[data-testid="topic-toggle-t-2"]').text()).toContain('Reativar')
    })

    it('can create the first topic of an empty subject', async () => {
      listBySubject.mockResolvedValue([])

      const { wrapper } = await render('/subjects/s-1/topics')

      expect(wrapper.find('[data-testid="topics-empty"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="topics-create"]').exists()).toBe(true)
    })

    it('creates a topic, keeping the same id when retrying', async () => {
      listBySubject.mockResolvedValue([])
      create.mockRejectedValueOnce(new ApiError('api.request_timeout'))
      create.mockResolvedValueOnce(ATOMS)

      const { wrapper } = await render('/subjects/s-1/topics')
      await wrapper.find('[data-testid="topics-create"]').trigger('click')
      await wrapper.find('[data-testid="topic-form-name"] input').setValue(' Átomos ')
      await wrapper.find('[data-testid="topic-form-save"]').trigger('click')
      await flushPromises()
      expect(wrapper.find('[data-testid="topic-form-error"]').exists()).toBe(true)

      await wrapper.find('[data-testid="topic-form-save"]').trigger('click')
      await flushPromises()

      expect(create).toHaveBeenCalledTimes(2)
      expect(create.mock.calls[0]?.[1]).toBe(create.mock.calls[1]?.[1])
      expect(create.mock.calls[0]?.[0]).toBe('s-1')
      expect(create.mock.calls[0]?.[2]).toEqual({ name: 'Átomos', description: '' })
      expect(wrapper.find('[data-testid="topic-form"]').exists()).toBe(false)
    })

    it('moves a topic up, and cannot move past either end', async () => {
      listBySubject.mockResolvedValue([ATOMS, IONS])
      reorder.mockResolvedValue([IONS, ATOMS])

      const { wrapper } = await render('/subjects/s-1/topics')
      expect(wrapper.find('[data-testid="topic-up-t-1"]').attributes('disabled')).toBeDefined()
      expect(wrapper.find('[data-testid="topic-down-t-2"]').attributes('disabled')).toBeDefined()

      await wrapper.find('[data-testid="topic-up-t-2"]').trigger('click')
      await flushPromises()

      expect(reorder).toHaveBeenCalledWith('s-1', ['t-2', 't-1'])
    })

    it('explains a stale order after reloading the list', async () => {
      listBySubject.mockResolvedValue([ATOMS, IONS])
      reorder.mockRejectedValue(new ApiError('content.topic.order_stale', {}, 409))

      const { wrapper } = await render('/subjects/s-1/topics')
      await wrapper.find('[data-testid="topic-up-t-2"]').trigger('click')
      await flushPromises()

      expect(listBySubject).toHaveBeenCalledTimes(2)
      expect(wrapper.find('[data-testid="topics-action-error"]').text()).toContain('A ordem dos conteúdos mudou')
    })

    it('asks before deactivating and reactivates at once', async () => {
      listBySubject.mockResolvedValue([ATOMS, IONS])
      deactivate.mockResolvedValue({ ...ATOMS, active: false })
      reactivate.mockResolvedValue({ ...IONS, active: true })

      const { wrapper } = await render('/subjects/s-1/topics')
      await wrapper.find('[data-testid="topic-toggle-t-1"]').trigger('click')
      expect(deactivate).not.toHaveBeenCalled()
      await wrapper.find('[data-testid="topic-deactivate-dialog-confirm"]').trigger('click')
      await flushPromises()
      await wrapper.find('[data-testid="topic-toggle-t-2"]').trigger('click')
      await flushPromises()

      expect(deactivate).toHaveBeenCalledWith('t-1')
      expect(reactivate).toHaveBeenCalledWith('t-2')
    })

    it('disables every change while offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      listBySubject.mockResolvedValue([ATOMS])

      const { wrapper } = await render('/subjects/s-1/topics')

      expect(wrapper.find('[data-testid="topics-create"]').attributes('disabled')).toBeDefined()
      expect(wrapper.find('[data-testid="topic-edit-t-1"]').attributes('disabled')).toBeDefined()
      expect(wrapper.find('[data-testid="topic-toggle-t-1"]').attributes('disabled')).toBeDefined()
    })
  })

  it('shows a list saved before topics had an active flag or a count without a false mark', async () => {
    await storage.set('u-1:content:topics:s-1', {
      value: [{ id: 't-1', name: 'Átomos', description: 'x', position: 0 }],
      savedAt: new Date(2026, 8, 30, 12, 40).toISOString(),
    })
    listBySubject.mockRejectedValue(new ApiError('api.network_unavailable'))

    const { wrapper } = await render('/subjects/s-1/topics')

    expect(wrapper.find('[data-testid="topic-t-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="topic-inactive"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="topic-question-count"]').exists()).toBe(false)
  })

  it('sends only the description when only the description was edited', async () => {
    listSubjects.mockResolvedValue([{ id: 's-1', name: 'Química', active: true, canAuthor: true }])
    listBySubject.mockResolvedValue([{ id: 't-1', name: 'Átomos', description: 'x', position: 0, active: true, questionCount: 3 }])
    update.mockResolvedValue({ id: 't-1' })

    const { wrapper } = await render('/subjects/s-1/topics')
    await wrapper.find('[data-testid="topic-edit-t-1"]').trigger('click')
    await wrapper.find('[data-testid="topic-form-description"] textarea').setValue(' novo ')
    await wrapper.find('[data-testid="topic-form-save"]').trigger('click')
    await flushPromises()

    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith('t-1', { description: 'novo' })
  })

  it('closes without a request when nothing was edited', async () => {
    listSubjects.mockResolvedValue([{ id: 's-1', name: 'Química', active: true, canAuthor: true }])
    listBySubject.mockResolvedValue([{ id: 't-1', name: 'Átomos', description: 'x', position: 0, active: true, questionCount: 3 }])

    const { wrapper } = await render('/subjects/s-1/topics')
    await wrapper.find('[data-testid="topic-edit-t-1"]').trigger('click')
    await wrapper.find('[data-testid="topic-form-save"]').trigger('click')
    await flushPromises()

    expect(update).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="topic-form"]').exists()).toBe(false)
  })

  it('shows a non-author no authoring controls and no counts', async () => {
    listBySubject.mockResolvedValue([{ id: 't-1', name: 'Átomos', description: 'x', position: 0, active: true, questionCount: null }])

    const { wrapper } = await render('/subjects/s-1/topics')

    expect(wrapper.find('[data-testid="topics-create"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="topic-edit-t-1"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="topic-question-count"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="topic-t-1"]').attributes('href')).toBeUndefined()
  })

  it('renders what the topic-actions slot adds to each card', async () => {
    listBySubject.mockResolvedValue([{ id: 't-1', name: 'Átomos', description: 'x', position: 1, active: true, questionCount: null }])
    const WithActions = {
      render: () => h(TopicsPage, null, {
        'topic-actions': ({ topic }: { topic: Topic }): VNode => h('span', { 'data-testid': `extra-${topic.id}` }, topic.name),
      }),
    }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/subjects/:subjectId/topics', component: WithActions }, { path: '/:any(.*)*', component: Stub }],
    })
    await router.push('/subjects/s-1/topics')

    const wrapper = mount(App, { global: { plugins: [vuetify, i18n, router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="extra-t-1"]').text()).toBe('Átomos')
  })
})
