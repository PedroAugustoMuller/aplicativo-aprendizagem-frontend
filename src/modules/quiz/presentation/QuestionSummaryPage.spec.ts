import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { i18n } from '@/shared/i18n'
import QuestionSummaryPage from '@/modules/quiz/presentation/QuestionSummaryPage.vue'
import { configureOffline } from '@/shared/offline/readThrough'
import { createMemoryStorage } from '@/shared/offline/storage'
import { configureViewerId } from '@/shared/auth/viewer'
import { ApiError } from '@/shared/api/error'
import type { QuestionStats } from '@/modules/quiz/domain/Progress'

const repo = vi.hoisted(() => ({
  subjectProgress: vi.fn(), topicHistory: vi.fn(), wrongQuestions: vi.fn(), attempt: vi.fn(), classroomProgress: vi.fn(), questionSummary: vi.fn(),
}))
vi.mock('@/modules/quiz/infrastructure/HttpProgressRepository', () => ({ progressRepository: repo }))

const vuetify = createVuetify({ components, directives })

const stats = (questionId: string, wrong: number, answered: number, extra: Partial<QuestionStats> = {}): QuestionStats => ({
  questionId, type: 'multiple_choice', statement: `Pergunta ${questionId}?`, answered, wrong,
  wrongPercent: Math.round((100 * wrong) / answered), correctOptionId: `${questionId}-a`,
  options: [{ id: `${questionId}-a`, text: 'Sódio', chosen: answered - wrong }, { id: `${questionId}-b`, text: 'Neônio', chosen: wrong }],
  otherChosen: 0, ...extra,
})

type Props = { scope?: 'classroom' | 'all'; admin?: boolean }

async function render(props: Props = {}) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:any(.*)*', component: { render: () => null } }] })
  await router.push('/')
  const wrapper = mount(QuestionSummaryPage, {
    props: { classroomId: 'c-1', classroomName: '9º A', topicId: 't-1', topicName: 'Tabela Periódica', scope: 'classroom', admin: false, ...props },
    global: { plugins: [vuetify, i18n, router] },
  })
  await flushPromises()

  return wrapper
}

describe('QuestionSummaryPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    configureOffline({ userId: () => 'u-1', storage: createMemoryStorage() })
    configureViewerId(() => 'u-1')
    repo.questionSummary.mockReset().mockResolvedValue({
      students: 18,
      questions: [stats('q-1', 13, 18), stats('q-2', 1, 10)],
    })
  })

  it('shows the topic, how many students and questions, and each question in the server order', async () => {
    const wrapper = await render()

    expect(wrapper.text()).toContain('Questões de Tabela Periódica')
    expect(wrapper.get('[data-testid="question-summary-context"]').text()).toBe('18 alunos · 2 questões respondidas')
    const first = wrapper.get('[data-testid="question-summary-q-1"]')
    expect(first.text()).toContain('Pergunta q-1?')
    expect(first.text()).toContain('72% erraram')
    expect(first.text()).toContain('13 de 18 alunos')
    expect(wrapper.findAll('[data-testid^="question-summary-q-"]').map((card) => card.attributes('data-testid'))).toEqual(['question-summary-q-1', 'question-summary-q-2'])
    expect(repo.questionSummary).toHaveBeenCalledWith({ kind: 'classroom', classroomId: 'c-1' }, 't-1')
  })

  it('marks the right option and counts who picked each one', async () => {
    const wrapper = await render()

    const right = wrapper.get('[data-testid="question-summary-option-q-1-a"]')
    expect(right.text()).toContain('Sódio')
    expect(right.text()).toContain('resposta certa')
    expect(right.text()).toContain('5 alunos')
    const wrong = wrapper.get('[data-testid="question-summary-option-q-2-b"]')
    expect(wrong.text()).not.toContain('resposta certa')
    expect(wrong.text()).toContain('1 aluno')
    expect(wrong.text()).not.toContain('1 alunos')
  })

  it.each([[30, 'low'], [31, 'mid'], [60, 'mid'], [61, 'high']])('puts %i percent wrong in the %s band', async (percent, band) => {
    repo.questionSummary.mockResolvedValue({ students: 100, questions: [stats('q-1', percent, 100)] })
    const wrapper = await render()

    expect(wrapper.get('[data-testid="question-summary-band-q-1"]').attributes('data-band')).toBe(band)
  })

  it('says how many students picked an option that was removed later, only when some did', async () => {
    repo.questionSummary.mockResolvedValue({ students: 3, questions: [stats('q-1', 2, 3, { otherChosen: 2 }), stats('q-2', 0, 3)] })
    const wrapper = await render()

    expect(wrapper.get('[data-testid="question-summary-removed-q-1"]').text()).toBe('Alternativa removida — 2 alunos')
    expect(wrapper.find('[data-testid="question-summary-removed-q-2"]').exists()).toBe(false)
  })

  it('says when nobody answered yet', async () => {
    repo.questionSummary.mockResolvedValue({ students: 4, questions: [] })
    const wrapper = await render()

    expect(wrapper.get('[data-testid="question-summary-empty"]').text()).toBe('Nenhum aluno respondeu questões deste conteúdo ainda.')
  })

  it('switches between the classroom and all classrooms', async () => {
    const wrapper = await render()

    expect(wrapper.get('[data-testid="question-summary-scope-classroom"]').text()).toBe('9º A')
    expect(wrapper.get('[data-testid="question-summary-scope-all"]').text()).toBe('Todas as minhas turmas')
    await wrapper.get('[data-testid="question-summary-scope-all"]').trigger('click')
    expect(wrapper.emitted('update:scope')).toEqual([['all']])

    await wrapper.setProps({ scope: 'all' })
    await flushPromises()
    expect(repo.questionSummary).toHaveBeenLastCalledWith({ kind: 'subject' }, 't-1')
  })

  it('names the whole subject for an admin', async () => {
    const wrapper = await render({ admin: true, scope: 'all' })

    expect(wrapper.get('[data-testid="question-summary-scope-all"]').text()).toBe('Todas as turmas da matéria')
    expect(repo.questionSummary).toHaveBeenCalledWith({ kind: 'subject' }, 't-1')
  })

  it('shows the saved copy offline and the error when there is none', async () => {
    await render()
    repo.questionSummary.mockRejectedValue(new ApiError('api.network_unavailable'))

    const saved = await render()
    expect(saved.find('[data-testid="offline-banner"]').exists()).toBe(true)
    expect(saved.find('[data-testid="question-summary-q-1"]').exists()).toBe(true)

    const failed = await render({ scope: 'all' })
    expect(failed.find('[data-testid="question-summary-error"]').exists()).toBe(true)
  })
})
