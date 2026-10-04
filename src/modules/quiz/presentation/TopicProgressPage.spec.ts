import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import TopicProgressPage from '@/modules/quiz/presentation/TopicProgressPage.vue'
import { useQuizStore } from '@/modules/quiz/application/quizStore'
import { configureOffline } from '@/shared/offline/readThrough'
import { createMemoryStorage } from '@/shared/offline/storage'
import { configureViewerId } from '@/shared/auth/viewer'
import { i18n } from '@/shared/i18n'
import type { TopicHistory } from '@/modules/quiz/domain/Progress'

const repo = vi.hoisted(() => ({ subjectProgress: vi.fn(), topicHistory: vi.fn(), wrongQuestions: vi.fn(), attempt: vi.fn(), classroomProgress: vi.fn() }))
vi.mock('@/modules/quiz/infrastructure/HttpProgressRepository', () => ({ progressRepository: repo }))
vi.mock('@/modules/quiz/infrastructure/HttpQuizRepository', () => ({ quizRepository: { start: vi.fn(), get: vi.fn(), answer: vi.fn() } }))

const vuetify = createVuetify({ components, directives })

const HISTORY: TopicHistory = {
  points: 180, tier: 'silver', nextTier: { tier: 'gold', points: 300 },
  attempts: [
    { id: 'a-3', startedAt: '2026-10-03T10:00:00+00:00', completedAt: null, total: 10, answered: 2, correct: 1, pointsBefore: 180, pointsAfter: 180, pointsChange: 0, tierBefore: 'silver', tierAfter: 'silver' },
    { id: 'a-2', startedAt: '2026-10-02T10:00:00+00:00', completedAt: '2026-10-02T10:10:00+00:00', total: 10, answered: 10, correct: 4, pointsBefore: 200, pointsAfter: 180, pointsChange: -20, tierBefore: 'silver', tierAfter: 'silver' },
    { id: 'a-1', startedAt: '2026-10-01T10:00:00+00:00', completedAt: '2026-10-01T10:10:00+00:00', total: 10, answered: 10, correct: 10, pointsBefore: 100, pointsAfter: 200, pointsChange: 100, tierBefore: 'bronze', tierAfter: 'silver' },
  ],
}
const WRONG = [{ questionId: 'q1', type: 'true_false' as const, statement: 'x', options: [], chosenOptionId: 'a', correctOptionId: 'b', explanation: null, answeredAt: 'x' }]

async function render(props: Record<string, unknown> = {}) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:any(.*)*', component: { render: () => null } }] })
  await router.push('/')
  const wrapper = mount(TopicProgressPage, {
    props: { topicId: 't-1', subjectId: 's-1', topicName: 'Tabela Periódica', source: { kind: 'own' }, ...props },
    global: { plugins: [vuetify, i18n, router] },
  })
  await flushPromises()

  return wrapper
}

describe('TopicProgressPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    configureOffline({ userId: () => 'u-1', storage: createMemoryStorage() })
    configureViewerId(() => 'u-1')
    Object.values(repo).forEach((fn) => fn.mockReset())
    repo.topicHistory.mockResolvedValue(HISTORY)
    repo.wrongQuestions.mockResolvedValue(WRONG)
  })

  it('shows the tier, the way to the next one and each quiz', async () => {
    const wrapper = await render()

    expect(wrapper.get('[data-testid="progress-title"]').text()).toBe('Tabela Periódica')
    expect(wrapper.get('[data-testid="tier-badge"]').attributes('data-tier')).toBe('silver')
    expect(wrapper.get('[data-testid="progress-to-next"]').text()).toBe('Faltam 120 pontos para Ouro')
    expect(wrapper.get('[data-testid="progress-bar"]').attributes('aria-valuenow')).toBe('20')
    expect(wrapper.get('[data-testid="progress-review-wrong"]').text()).toContain('Revisar questões erradas (1)')
    expect(wrapper.get('[data-testid="progress-review-wrong"]').attributes('href')).toBe('/subjects/s-1/topics/t-1/review')
    expect(wrapper.get('[data-testid="progress-attempt-0"]').text()).toContain('em andamento')
    expect(wrapper.get('[data-testid="progress-attempt-0"]').attributes('href')).toBe('/quiz/a-3')
    expect(wrapper.get('[data-testid="progress-attempt-1"]').text()).toContain('4 de 10')
    expect(wrapper.get('[data-testid="progress-attempt-1"]').attributes('href')).toBe('/quiz/a-2/review')
    expect(wrapper.get('[data-testid="progress-attempt-change-1"]').text()).toBe('−20')
    expect(wrapper.get('[data-testid="progress-attempt-change-2"]').text()).toBe('+100')
    expect(repo.topicHistory).toHaveBeenCalledWith({ kind: 'own' }, 't-1')
  })

  it('says max tier at diamond and disables the review button with nothing wrong', async () => {
    repo.topicHistory.mockResolvedValue({ points: 820, tier: 'diamond', nextTier: null, attempts: [] })
    repo.wrongQuestions.mockResolvedValue([])
    const wrapper = await render()

    expect(wrapper.get('[data-testid="progress-to-next"]').text()).toBe('Nível máximo!')
    expect(wrapper.get('[data-testid="progress-bar"]').attributes('aria-valuenow')).toBe('100')
    expect(wrapper.get('[data-testid="progress-review-wrong"]').classes()).toContain('v-btn--disabled')
    expect(wrapper.get('[data-testid="progress-empty"]').text()).toBe('Nenhum quiz feito ainda neste conteúdo.')
  })

  it('is read-only for staff: the student name, staff links, no link on an open quiz', async () => {
    const wrapper = await render({ source: { kind: 'student', classroomId: 'c-1', studentId: 'u-9' }, studentName: 'Carla Dias' })

    expect(wrapper.text()).toContain('Desempenho de Carla Dias')
    expect(wrapper.get('[data-testid="progress-attempt-0"]').attributes('href')).toBeUndefined()
    expect(wrapper.get('[data-testid="progress-attempt-1"]').attributes('href')).toBe('/classrooms/c-1/students/u-9/quiz/a-2/review')
    expect(wrapper.get('[data-testid="progress-review-wrong"]').attributes('href')).toBe('/classrooms/c-1/students/u-9/topics/t-1/review')
    expect(repo.topicHistory).toHaveBeenCalledWith({ kind: 'student', classroomId: 'c-1', studentId: 'u-9' }, 't-1')
  })

  it('warns that pending answers will still change the points, and reloads once they are sent', async () => {
    const quiz = useQuizStore()
    quiz.pendingCount = 2
    const wrapper = await render()

    expect(wrapper.find('[data-testid="progress-pending"]').exists()).toBe(true)

    quiz.pendingCount = 0
    await flushPromises()

    expect(repo.topicHistory).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="progress-pending"]').exists()).toBe(false)
  })

  it('never shows staff the pending notice', async () => {
    useQuizStore().pendingCount = 2
    const wrapper = await render({ source: { kind: 'student', classroomId: 'c-1', studentId: 'u-9' }, studentName: 'Carla Dias' })

    expect(wrapper.find('[data-testid="progress-pending"]').exists()).toBe(false)
  })
})
