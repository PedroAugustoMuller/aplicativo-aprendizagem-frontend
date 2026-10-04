import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import QuizPage from '@/modules/quiz/presentation/QuizPage.vue'
import { useQuizStore } from '@/modules/quiz/application/quizStore'
import { configureViewerId } from '@/shared/auth/viewer'
import { i18n } from '@/shared/i18n'
import { ApiError } from '@/shared/api/error'
import type { Attempt } from '@/modules/quiz/domain/Attempt'

// presentation/ never reaches infrastructure/: mock the repository by path, seed through the store.
const { start, get, answer } = vi.hoisted(() => ({ start: vi.fn(), get: vi.fn(), answer: vi.fn() }))
vi.mock('@/modules/quiz/infrastructure/HttpQuizRepository', () => ({ quizRepository: { start, get, answer } }))
const progressApi = vi.hoisted(() => ({ subjectProgress: vi.fn(), topicHistory: vi.fn(), wrongQuestions: vi.fn(), attempt: vi.fn(), classroomProgress: vi.fn() }))
vi.mock('@/modules/quiz/infrastructure/HttpProgressRepository', () => ({ progressRepository: progressApi }))

const vuetify = createVuetify({ components, directives })
const Stub = { render: () => null }
const ATTEMPT: Attempt = {
  id: 'a-1', topicId: 't-1', startedAt: 's', completedAt: null, score: { total: 2, answered: 0, correct: 0 },
  questions: [
    { id: 'q1', position: 0, type: 'true_false', statement: 'O sódio é um metal.', options: [{ id: 'q1-v', text: 'Verdadeiro' }, { id: 'q1-f', text: 'Falso' }], result: null },
    { id: 'q2', position: 1, type: 'multiple_choice', statement: 'Símbolo do sódio?', options: [{ id: 'q2-s', text: 'S' }, { id: 'q2-na', text: 'Na' }], result: null },
  ],
}
const outcome = (questionId: string, optionId: string, correctOptionId: string) => ({
  result: { questionId, optionId, correct: optionId === correctOptionId, correctOptionId, explanation: 'Vem do latim natrium.' },
  score: ATTEMPT.score,
  completed: false,
})
const offline = () => Promise.reject(new ApiError('api.network_unavailable'))

async function render() {
  // A fresh store, as after a reload: the page reads the device copy, not memory.
  setActivePinia(createPinia())
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/quiz/:attemptId', component: QuizPage }, { path: '/:any(.*)*', component: Stub }],
  })
  await router.push('/quiz/a-1')
  const wrapper = mount({ render: () => h(RouterView) }, { global: { plugins: [vuetify, i18n, router] } })
  await flushPromises()

  return { wrapper, router }
}

async function respond(wrapper: Awaited<ReturnType<typeof render>>['wrapper'], option: number): Promise<void> {
  await wrapper.find(`[data-testid="quiz-option-${option}"]`).trigger('click')
  await wrapper.find('[data-testid="quiz-submit"]').trigger('click')
  await flushPromises()
}

describe('QuizPage', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    configureViewerId(() => 'u-1')
    const store = useQuizStore()
    await store.discardDeviceData()
    start.mockResolvedValue(ATTEMPT)
    await store.prepare('t-1', { topicName: 'Tabela Periódica', subjectId: 's-1' })
    get.mockResolvedValue(ATTEMPT)
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })

  it('shows the first question, with Responder enabled only after choosing', async () => {
    const { wrapper } = await render()

    expect(wrapper.find('[data-testid="quiz-title"]').text()).toBe('Tabela Periódica')
    expect(wrapper.find('[data-testid="quiz-progress-label"]').text()).toBe('Questão 1 de 2')
    expect(wrapper.find('[data-testid="quiz-statement"]').text()).toBe('O sódio é um metal.')
    expect(wrapper.find('[data-testid="quiz-submit"]').attributes('disabled')).toBeDefined()

    await wrapper.find('[data-testid="quiz-option-0"]').trigger('click')

    expect(wrapper.find('[data-testid="quiz-submit"]').attributes('disabled')).toBeUndefined()
    expect(answer).not.toHaveBeenCalled()
  })

  it('says right, with the explanation, then moves on', async () => {
    answer.mockResolvedValue(outcome('q1', 'q1-v', 'q1-v'))
    const { wrapper } = await render()

    await respond(wrapper, 0)

    expect(wrapper.find('[data-testid="quiz-feedback-correct"]').text()).toContain('Certo!')
    expect(wrapper.find('[data-testid="quiz-explanation"]').text()).toContain('Vem do latim natrium.')
    await wrapper.find('[data-testid="quiz-next"]').trigger('click')
    expect(wrapper.find('[data-testid="quiz-progress-label"]').text()).toBe('Questão 2 de 2')
  })

  it('says wrong and names the right answer', async () => {
    answer.mockResolvedValue(outcome('q1', 'q1-f', 'q1-v'))
    const { wrapper } = await render()

    await respond(wrapper, 1)

    expect(wrapper.find('[data-testid="quiz-feedback-wrong"]').text()).toContain('Não foi dessa vez. A resposta certa é: Verdadeiro')
  })

  it('keeps an offline answer and says the result comes later', async () => {
    answer.mockImplementation(offline)
    const { wrapper } = await render()

    await respond(wrapper, 0)

    expect(wrapper.find('[data-testid="quiz-feedback-pending"]').text()).toBe('Resposta guardada. O resultado aparece quando a internet voltar.')
    expect(wrapper.find('[data-testid="quiz-next"]').attributes('disabled')).toBeUndefined()
  })

  it('resumes at the first unanswered question', async () => {
    answer.mockResolvedValue(outcome('q1', 'q1-v', 'q1-v'))
    const store = useQuizStore()
    await store.open('a-1')
    await store.answer('q1', 'q1-v')
    get.mockImplementation(offline)

    const { wrapper } = await render()

    expect(wrapper.find('[data-testid="quiz-progress-label"]').text()).toBe('Questão 2 de 2')
  })

  it('ends with the score, the pending notice and the way back', async () => {
    answer.mockResolvedValueOnce(outcome('q1', 'q1-v', 'q1-v')).mockImplementation(offline)
    const { wrapper } = await render()

    await respond(wrapper, 0)
    await wrapper.find('[data-testid="quiz-next"]').trigger('click')
    await respond(wrapper, 1)
    await wrapper.find('[data-testid="quiz-next"]').trigger('click')

    expect(wrapper.find('[data-testid="quiz-score"]').text()).toBe('Você acertou 1 de 2')
    expect(wrapper.find('[data-testid="quiz-results-pending"]').text()).toContain('1 resposta ainda vai ser enviada.')
    expect(wrapper.find('[data-testid="quiz-result-1"]').text()).toContain('Aguardando envio')
    expect(wrapper.find('[data-testid="quiz-results-back"]').attributes('href')).toBe('/subjects/s-1/topics')
    expect(wrapper.find('[data-testid="quiz-new"]').attributes('disabled')).toBeDefined()
  })

  it('ends a fully graded quiz with the topic tier', async () => {
    progressApi.topicHistory.mockResolvedValue({
      points: 60, tier: 'bronze', nextTier: { tier: 'silver', points: 150 },
      attempts: [{ id: 'a-1', startedAt: 's', completedAt: 'c', total: 2, answered: 2, correct: 2, pointsBefore: 40, pointsAfter: 60, pointsChange: 20, tierBefore: 'iron', tierAfter: 'bronze' }],
    })
    progressApi.wrongQuestions.mockResolvedValue([])
    answer.mockResolvedValueOnce(outcome('q1', 'q1-v', 'q1-v')).mockResolvedValueOnce(outcome('q2', 'q2-na', 'q2-na'))
    const { wrapper } = await render()

    await respond(wrapper, 0)
    await wrapper.find('[data-testid="quiz-next"]').trigger('click')
    await respond(wrapper, 1)
    await wrapper.find('[data-testid="quiz-next"]').trigger('click')
    await flushPromises()

    expect(progressApi.topicHistory).toHaveBeenCalledWith({ kind: 'own' }, 't-1')
    expect(wrapper.find('[data-testid="quiz-results-tier"]').text()).toBe('Você está no nível Bronze (60 pts)')
  })

  it('shows no tier while answers wait to be sent', async () => {
    answer.mockResolvedValueOnce(outcome('q1', 'q1-v', 'q1-v')).mockImplementation(offline)
    const { wrapper } = await render()

    await respond(wrapper, 0)
    await wrapper.find('[data-testid="quiz-next"]').trigger('click')
    await respond(wrapper, 1)
    await wrapper.find('[data-testid="quiz-next"]').trigger('click')
    await flushPromises()

    expect(progressApi.topicHistory).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="quiz-results-tier"]').exists()).toBe(false)
  })

  it('shows the translated error when the quiz is unknown and nothing was saved', async () => {
    await useQuizStore().discardDeviceData()
    get.mockRejectedValue(new ApiError('quiz.attempt_not_found', {}, 404))

    const { wrapper } = await render()

    expect(wrapper.find('[data-testid="quiz-error"]').text()).toContain('Não encontramos este quiz.')
  })

  it('lets a quiz whose answers the server refused be taken again from the results', async () => {
    answer.mockRejectedValue(new ApiError('quiz.answer.invalid_option', {}, 422))
    const { wrapper } = await render()
    await respond(wrapper, 0)
    await wrapper.find('[data-testid="quiz-next"]').trigger('click')
    await respond(wrapper, 0)
    await wrapper.find('[data-testid="quiz-next"]').trigger('click')
    expect(wrapper.find('[data-testid="quiz-results"]').exists()).toBe(true)

    // The server still has this attempt open, so "Novo quiz" hands it back.
    await wrapper.find('[data-testid="quiz-new"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="quiz-progress-label"]').text()).toBe('Questão 1 de 2')
  })
})
