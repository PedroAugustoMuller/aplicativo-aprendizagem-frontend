import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import TopicsPage from '@/modules/content/presentation/TopicsPage.vue'
import { i18n } from '@/shared/i18n'
import { ApiError } from '@/shared/api/error'

const { listSubjects, listBySubject } = vi.hoisted(() => ({
  listSubjects: vi.fn(),
  listBySubject: vi.fn(),
}))

vi.mock('@/modules/content/infrastructure/HttpSubjectRepository', () => ({
  subjectRepository: { list: listSubjects },
}))
vi.mock('@/modules/content/infrastructure/HttpTopicRepository', () => ({
  topicRepository: { listBySubject },
}))

const vuetify = createVuetify({ components, directives })
// Plain component objects: a stand-in route and a RouterView host for the page.
const Stub = { render: () => null }
const App = { render: () => h(RouterView) }

const SUBJECTS = [
  { id: 's-1', name: 'Química', active: true },
  { id: 's-2', name: 'Biologia', active: true },
]

async function render(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/subjects', component: Stub },
      { path: '/subjects/:subjectId/topics', component: TopicsPage },
    ],
  })
  await router.push(path)

  const wrapper = mount(App, { global: { plugins: [vuetify, i18n, router] } })
  await flushPromises()

  return { wrapper, router }
}

describe('TopicsPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
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
})
