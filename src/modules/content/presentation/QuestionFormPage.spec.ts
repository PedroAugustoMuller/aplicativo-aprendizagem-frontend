import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import QuestionFormPage from '@/modules/content/presentation/QuestionFormPage.vue'
import { i18n } from '@/shared/i18n'
import { ApiError } from '@/shared/api/error'

const { listBySubject, listByTopic, create, update } = vi.hoisted(() => ({
  listBySubject: vi.fn(),
  listByTopic: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/modules/content/infrastructure/HttpTopicRepository', () => ({ topicRepository: { listBySubject } }))
vi.mock('@/modules/content/infrastructure/HttpQuestionRepository', () => ({
  questionRepository: { listByTopic, create, update },
}))

const vuetify = createVuetify({ components, directives })
const Stub = { render: () => null }
const App = { render: () => h(RouterView) }
const BANK = '/subjects/s-1/topics/t-1/questions'

const SODIUM = {
  id: 'q-1', topicId: 't-1', type: 'multiple_choice', statement: 'Símbolo do sódio?', explanation: null,
  active: true, version: 3,
  options: [{ id: 'o-1', text: 'Na', correct: true }, { id: 'o-2', text: 'S', correct: false }],
}

async function render(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/subjects/:subjectId/topics/:topicId/questions', component: Stub },
      { path: '/subjects/:subjectId/topics/:topicId/questions/new', component: QuestionFormPage },
      { path: '/subjects/:subjectId/topics/:topicId/questions/:questionId/edit', component: QuestionFormPage },
    ],
  })
  await router.push(path)

  const wrapper = mount(App, { global: { plugins: [vuetify, i18n, router] } })
  await flushPromises()

  return { wrapper, router }
}

async function fill(wrapper: VueWrapper, testid: string, value: string): Promise<void> {
  await wrapper.find(`[data-testid="${testid}"] input, [data-testid="${testid}"] textarea:not(.v-textarea__sizer)`).setValue(value)
}

function statementValue(wrapper: VueWrapper): string {
  return (wrapper.find('[data-testid="question-form-statement"] textarea:not(.v-textarea__sizer)').element as HTMLTextAreaElement).value
}

async function save(wrapper: VueWrapper): Promise<void> {
  await wrapper.find('[data-testid="question-form-save"]').trigger('click')
  await flushPromises()
}

describe('QuestionFormPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    listBySubject.mockResolvedValue([{ id: 't-1', name: 'Tabela Periódica', description: '', position: 0, active: true, questionCount: 1 }])
    listByTopic.mockResolvedValue([SODIUM])
  })

  it('creates a multiple-choice question and returns to the bank', async () => {
    create.mockResolvedValue(SODIUM)
    const { wrapper, router } = await render(`${BANK}/new`)

    await fill(wrapper, 'question-form-statement', ' Símbolo do sódio? ')
    await fill(wrapper, 'question-form-option-text-0', 'Na')
    await fill(wrapper, 'question-form-option-text-1', 'S')
    await wrapper.find('[data-testid="question-form-correct-0"] input').setValue(true)
    await save(wrapper)

    expect(create).toHaveBeenCalledWith('t-1', expect.any(String), {
      type: 'multiple_choice',
      statement: 'Símbolo do sódio?',
      explanation: null,
      options: [{ id: null, text: 'Na', correct: true }, { id: null, text: 'S', correct: false }],
    })
    expect(router.currentRoute.value.path).toBe(BANK)
  })

  it('keeps everything typed and the same id when a save fails and is retried', async () => {
    create.mockRejectedValueOnce(new ApiError('api.request_timeout'))
    create.mockResolvedValueOnce(SODIUM)
    const { wrapper } = await render(`${BANK}/new`)

    await wrapper.find('[data-testid="question-form-type-true_false"]').trigger('click')
    await fill(wrapper, 'question-form-statement', 'O sódio é um metal.')
    await wrapper.find('[data-testid="question-form-answer-true"] input').setValue(true)
    await save(wrapper)

    expect(wrapper.find('[data-testid="question-form-error"]').text()).toContain('demorou demais')
    expect(wrapper.find('[data-testid="question-form-save"]').text()).toBe('Tentar de novo')
    expect(statementValue(wrapper)).toBe('O sódio é um metal.')

    await save(wrapper)

    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls[0]?.[1]).toBe(create.mock.calls[1]?.[1])
    expect(create.mock.calls[1]?.[2]).toEqual({ type: 'true_false', statement: 'O sódio é um metal.', explanation: null, answer: true })
  })

  it('explains problems instead of sending', async () => {
    const { wrapper } = await render(`${BANK}/new`)

    await fill(wrapper, 'question-form-option-text-0', 'Na')
    await fill(wrapper, 'question-form-option-text-1', ' na ')
    await save(wrapper)

    const problems = wrapper.find('[data-testid="question-form-problems"]').text()
    expect(problems).toContain('Escreva o enunciado.')
    expect(problems).toContain('Há alternativas repetidas.')
    expect(problems).toContain('Marque uma alternativa como correta.')
    expect(create).not.toHaveBeenCalled()
  })

  it('allows 2 to 5 options', async () => {
    const { wrapper } = await render(`${BANK}/new`)
    const add = () => wrapper.find('[data-testid="question-form-add-option"]')

    expect(wrapper.find('[data-testid="question-form-remove-0"]').attributes('disabled')).toBeDefined()
    for (let i = 0; i < 3; i++) {
      await add().trigger('click')
    }

    expect(wrapper.find('[data-testid="question-form-option-text-4"]').exists()).toBe(true)
    expect(add().attributes('disabled')).toBeDefined()
    await wrapper.find('[data-testid="question-form-remove-4"]').trigger('click')
    expect(wrapper.find('[data-testid="question-form-option-text-4"]').exists()).toBe(false)
  })

  it('cannot save while offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    const { wrapper } = await render(`${BANK}/new`)

    expect(wrapper.find('[data-testid="question-form-save"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="offline-hint"]').exists()).toBe(true)
  })

  it('edits an existing question with the version it read, keeping option ids', async () => {
    update.mockResolvedValue(SODIUM)
    const { wrapper } = await render(`${BANK}/q-1/edit`)

    expect(wrapper.find('[data-testid="question-form-type-true_false"]').exists()).toBe(false)
    await fill(wrapper, 'question-form-option-text-1', 'Sd')
    await save(wrapper)

    expect(update).toHaveBeenCalledWith('q-1', 3, {
      type: 'multiple_choice',
      statement: 'Símbolo do sódio?',
      explanation: null,
      options: [{ id: 'o-1', text: 'Na', correct: true }, { id: 'o-2', text: 'Sd', correct: false }],
    })
  })

  it('offers to reload when someone else changed the question', async () => {
    update.mockRejectedValue(new ApiError('content.question.edited_elsewhere', {}, 409))
    const { wrapper } = await render(`${BANK}/q-1/edit`)
    await fill(wrapper, 'question-form-statement', 'Minha versão')
    await save(wrapper)

    expect(wrapper.find('[data-testid="question-form-error"]').text()).toContain('Outra pessoa alterou')
    expect(wrapper.find('[data-testid="question-form-save"]').attributes('disabled')).toBeDefined()

    listByTopic.mockResolvedValue([{ ...SODIUM, statement: 'Versão dela', version: 4 }])
    await wrapper.find('[data-testid="question-form-reload"]').trigger('click')
    await flushPromises()

    expect(statementValue(wrapper)).toBe('Versão dela')
    update.mockResolvedValue(SODIUM)
    await save(wrapper)
    expect(update).toHaveBeenLastCalledWith('q-1', 4, expect.objectContaining({ statement: 'Versão dela' }))
  })

  it('says so when the question does not exist', async () => {
    const { wrapper } = await render(`${BANK}/q-404/edit`)

    expect(wrapper.find('[data-testid="question-form-missing"]').text()).toBe('Questão não encontrada.')
  })

  it('asks before leaving with unsaved changes', async () => {
    const { wrapper, router } = await render(`${BANK}/new`)
    await fill(wrapper, 'question-form-statement', 'Rascunho')

    await router.push(BANK)
    await flushPromises()
    expect(router.currentRoute.value.path).toBe(`${BANK}/new`)

    await wrapper.find('[data-testid="question-form-leave-confirm"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe(BANK)
  })

  it('leaves at once when nothing changed', async () => {
    const { router } = await render(`${BANK}/new`)

    await router.push(BANK)
    await flushPromises()

    expect(router.currentRoute.value.path).toBe(BANK)
  })
})
