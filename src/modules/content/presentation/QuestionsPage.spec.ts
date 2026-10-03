import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import QuestionsPage from '@/modules/content/presentation/QuestionsPage.vue'
import { i18n } from '@/shared/i18n'
import { ApiError } from '@/shared/api/error'
import { configureOffline } from '@/shared/offline/readThrough'
import { createMemoryStorage, type OfflineStorage } from '@/shared/offline/storage'

const { listBySubject, listByTopic, deactivate, reactivate } = vi.hoisted(() => ({
  listBySubject: vi.fn(),
  listByTopic: vi.fn(),
  deactivate: vi.fn(),
  reactivate: vi.fn(),
}))

vi.mock('@/modules/content/infrastructure/HttpTopicRepository', () => ({ topicRepository: { listBySubject } }))
vi.mock('@/modules/content/infrastructure/HttpQuestionRepository', () => ({
  questionRepository: { listByTopic, deactivate, reactivate },
}))

const vuetify = createVuetify({ components, directives })
const Stub = { render: () => null }
const App = { render: () => h(RouterView) }
let storage: OfflineStorage

const SODIUM = {
  id: 'q-1', topicId: 't-1', type: 'multiple_choice', statement: 'Símbolo do sódio?', explanation: 'Natrium.',
  active: true, version: 1,
  options: [{ id: 'o-1', text: 'Na', correct: true }, { id: 'o-2', text: 'S', correct: false }],
}
const METAL = {
  id: 'q-2', topicId: 't-1', type: 'true_false', statement: 'O sódio é um metal.', explanation: null,
  active: false, version: 1,
  options: [{ id: 'v', text: 'Verdadeiro', correct: true }, { id: 'f', text: 'Falso', correct: false }],
}

async function render() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/subjects/:subjectId/topics', component: Stub },
      { path: '/subjects/:subjectId/topics/:topicId/questions', component: QuestionsPage },
      { path: '/subjects/:subjectId/topics/:topicId/questions/new', component: Stub },
      { path: '/subjects/:subjectId/topics/:topicId/questions/:questionId/edit', component: Stub },
    ],
  })
  await router.push('/subjects/s-1/topics/t-1/questions')

  const wrapper = mount(App, { global: { plugins: [vuetify, i18n, router] } })
  await flushPromises()

  return { wrapper, router }
}

describe('QuestionsPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    storage = createMemoryStorage()
    configureOffline({ userId: () => 'u-1', storage })
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    listBySubject.mockResolvedValue([{ id: 't-1', name: 'Tabela Periódica', description: '', position: 0, active: true, questionCount: 1 }])
  })

  it('titles the page with the topic and links back to its subject', async () => {
    listByTopic.mockResolvedValue([])

    const { wrapper } = await render()

    expect(wrapper.find('[data-testid="questions-title"]').text()).toBe('Tabela Periódica')
    expect(wrapper.find('[data-testid="questions-back"]').attributes('href')).toBe('/subjects/s-1/topics')
    expect(wrapper.find('[data-testid="questions-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="questions-create"]').attributes('href')).toBe('/subjects/s-1/topics/t-1/questions/new')
  })

  it('shows each active question with its type, answer and explanation', async () => {
    listByTopic.mockResolvedValue([SODIUM, METAL])

    const { wrapper } = await render()

    const card = wrapper.find('[data-testid="question-q-1"]')
    expect(card.text()).toContain('Símbolo do sódio?')
    expect(wrapper.find('[data-testid="question-type-q-1"]').text()).toBe('Múltipla escolha')
    expect(card.find('[data-testid="question-correct"]').text()).toContain('Na')
    expect(card.find('[data-testid="question-correct"]').text()).toContain('Correta')
    expect(card.find('[data-testid="question-explanation"]').text()).toBe('Explicação: Natrium.')
    expect(wrapper.find('[data-testid="question-q-2"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="question-edit-q-1"]').attributes('href')).toBe('/subjects/s-1/topics/t-1/questions/q-1/edit')
  })

  it('shows deactivated questions on request', async () => {
    listByTopic.mockResolvedValue([SODIUM, METAL])

    const { wrapper } = await render()
    await wrapper.find('[data-testid="questions-show-inactive"] input').setValue(true)

    expect(wrapper.find('[data-testid="question-q-2"] [data-testid="question-inactive"]').text()).toBe('Desativada')
    expect(wrapper.find('[data-testid="question-type-q-2"]').text()).toBe('V ou F')
    expect(wrapper.find('[data-testid="question-toggle-q-2"]').text()).toContain('Reativar')
  })

  it('asks before deactivating', async () => {
    listByTopic.mockResolvedValue([SODIUM])
    deactivate.mockResolvedValue({ ...SODIUM, active: false })

    const { wrapper } = await render()
    await wrapper.find('[data-testid="question-toggle-q-1"]').trigger('click')
    expect(deactivate).not.toHaveBeenCalled()
    await wrapper.find('[data-testid="question-deactivate-dialog-confirm"]').trigger('click')
    await flushPromises()

    expect(deactivate).toHaveBeenCalledWith('q-1')
  })

  it('shows a translated 403 for a teacher of another subject', async () => {
    listByTopic.mockRejectedValue(new ApiError('auth.forbidden', {}, 403))

    const { wrapper } = await render()

    expect(wrapper.find('[data-testid="questions-error"]').text()).toContain('Você não tem permissão para isso.')
  })

  it('reads the saved bank offline with writes disabled', async () => {
    await storage.set('u-1:content:questions:t-1', { value: [SODIUM], savedAt: new Date(2026, 9, 2, 9, 15).toISOString() })
    listByTopic.mockRejectedValue(new ApiError('api.network_unavailable'))
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    const { wrapper } = await render()

    expect(wrapper.find('[data-testid="question-q-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="offline-banner"]').text()).toContain('09:15')
    expect(wrapper.find('[data-testid="questions-create"]').classes()).toContain('v-btn--disabled')
    expect(wrapper.find('[data-testid="question-toggle-q-1"]').attributes('disabled')).toBeDefined()
  })
})
