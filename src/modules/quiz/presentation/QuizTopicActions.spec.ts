import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import QuizTopicActions from '@/modules/quiz/presentation/QuizTopicActions.vue'
import { useQuizStore } from '@/modules/quiz/application/quizStore'
import { configureViewer, configureViewerId } from '@/shared/auth/viewer'
import { i18n } from '@/shared/i18n'
import { ApiError } from '@/shared/api/error'
import type { Attempt } from '@/modules/quiz/domain/Attempt'

// presentation/ never reaches infrastructure/: mock the repository by path, seed through the store.
const { start, get, answer } = vi.hoisted(() => ({ start: vi.fn(), get: vi.fn(), answer: vi.fn() }))
vi.mock('@/modules/quiz/infrastructure/HttpQuizRepository', () => ({ quizRepository: { start, get, answer } }))

const vuetify = createVuetify({ components, directives })
const Stub = { render: () => null }
const ATTEMPT: Attempt = {
  id: 'a-1', topicId: 't-1', startedAt: 's', completedAt: null, score: { total: 2, answered: 0, correct: 0 },
  questions: ['q1', 'q2'].map((id, position) => ({
    id, position, type: 'true_false' as const, statement: id, options: [{ id: `${id}-v`, text: 'Verdadeiro' }, { id: `${id}-f`, text: 'Falso' }], result: null,
  })),
}
const offline = () => Promise.reject(new ApiError('api.network_unavailable'))

async function render() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:any(.*)*', component: Stub }] })
  await router.push('/subjects/s-1/topics')
  const wrapper = mount(QuizTopicActions, {
    props: { topicId: 't-1', subjectId: 's-1', topicName: 'Tabela Periódica' },
    global: { plugins: [vuetify, i18n, router] },
  })
  await flushPromises()

  return { wrapper, router }
}

describe('QuizTopicActions', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    configureViewer(() => 'student')
    configureViewerId(() => 'u-1')
    await useQuizStore().discardDeviceData()
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })

  it('offers to start or download a quiz', async () => {
    const { wrapper } = await render()

    expect(wrapper.find('[data-testid="quiz-start-t-1"]').text()).toBe('Começar quiz')
    expect(wrapper.find('[data-testid="quiz-download-t-1"]').attributes('aria-label')).toBe('Baixar para fazer sem internet')
  })

  it('starts a quiz and opens it', async () => {
    start.mockResolvedValue(ATTEMPT)
    const { wrapper, router } = await render()

    await wrapper.find('[data-testid="quiz-start-t-1"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/quiz/a-1')
  })

  it('downloads a quiz and then shows it as available offline', async () => {
    start.mockResolvedValue(ATTEMPT)
    const { wrapper, router } = await render()

    await wrapper.find('[data-testid="quiz-download-t-1"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/subjects/s-1/topics')
    expect(wrapper.find('[data-testid="quiz-downloaded-t-1"]').text()).toBe('Disponível sem internet')
    expect(wrapper.find('[data-testid="quiz-continue-t-1"]').text()).toBe('Continuar quiz (0 de 2)')
  })

  it('continues an open quiz from the device', async () => {
    start.mockResolvedValue(ATTEMPT)
    get.mockImplementation(offline)
    answer.mockImplementation(offline)
    const store = useQuizStore()
    await store.prepare('t-1', { topicName: 'T', subjectId: 's-1' })
    await store.open('a-1')
    await store.answer('q1', 'q1-v')
    setActivePinia(createPinia())

    const { wrapper, router } = await render()

    expect(wrapper.find('[data-testid="quiz-continue-t-1"]').text()).toBe('Continuar quiz (1 de 2)')
    await wrapper.find('[data-testid="quiz-continue-t-1"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/quiz/a-1')
  })

  it('explains why a quiz cannot start offline when none was downloaded', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    const { wrapper } = await render()

    expect(wrapper.find('[data-testid="quiz-start-t-1"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="quiz-offline-t-1"]').text()).toBe('Sem internet. Baixe o quiz antes para poder fazer sem conexão.')
  })

  it('shows the translated reason when the topic has no questions', async () => {
    start.mockRejectedValue(new ApiError('quiz.topic.no_questions', {}, 409))
    const { wrapper } = await render()

    await wrapper.find('[data-testid="quiz-start-t-1"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="quiz-actions-error-t-1"]').text()).toContain('Este conteúdo ainda não tem questões.')
  })

  it('shows nothing to staff', async () => {
    configureViewer(() => 'teacher')
    const { wrapper } = await render()

    expect(wrapper.find('[data-testid="quiz-start-t-1"]').exists()).toBe(false)
  })
})
