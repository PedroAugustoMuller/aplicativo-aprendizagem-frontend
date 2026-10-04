import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import TopicsWithQuiz from '@/shared/ui/TopicsWithQuiz.vue'
import { configureViewer, configureViewerId } from '@/shared/auth/viewer'
import { configureOffline } from '@/shared/offline/readThrough'
import { createMemoryStorage } from '@/shared/offline/storage'
import { i18n } from '@/shared/i18n'
import { ApiError } from '@/shared/api/error'
import { useQuizStore } from '@/modules/quiz/application/quizStore'

// shared/ui reaches modules only through application/ and presentation/: mock by path.
vi.mock('@/modules/content/infrastructure/HttpSubjectRepository', () => ({
  subjectRepository: { list: vi.fn().mockResolvedValue([{ id: 's-1', name: 'Química', active: true, canAuthor: false }]) },
}))
vi.mock('@/modules/content/infrastructure/HttpTopicRepository', () => ({
  topicRepository: { listBySubject: vi.fn().mockResolvedValue([{ id: 't-1', name: 'Átomos', description: '', position: 0, active: true, questionCount: null }]) },
}))
const progressApi = vi.hoisted(() => ({ subjectProgress: vi.fn(), topicHistory: vi.fn(), wrongQuestions: vi.fn(), attempt: vi.fn(), classroomProgress: vi.fn() }))
vi.mock('@/modules/quiz/infrastructure/HttpProgressRepository', () => ({ progressRepository: progressApi }))
vi.mock('@/modules/quiz/infrastructure/HttpQuizRepository', () => ({ quizRepository: { start: vi.fn(), get: vi.fn(), answer: vi.fn() } }))

const vuetify = createVuetify({ components, directives })

describe('TopicsWithQuiz', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    configureOffline({ userId: () => 'u-1', storage: createMemoryStorage() })
    configureViewerId(() => 'u-1')
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    progressApi.subjectProgress.mockReset().mockResolvedValue([{ topicId: 't-1', points: 180, tier: 'silver', nextTier: { tier: 'gold', points: 300 } }])
  })

  it('puts the quiz actions on a student\'s topic cards', async () => {
    configureViewer(() => 'student')
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/subjects/:subjectId/topics', component: TopicsWithQuiz }] })
    await router.push('/subjects/s-1/topics')

    const wrapper = mount({ render: () => h(RouterView) }, { global: { plugins: [vuetify, i18n, router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="topic-t-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="quiz-start-t-1"]').exists()).toBe(true)
  })

  it('shows a student their tier on each topic card, linking to their progress', async () => {
    configureViewer(() => 'student')
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/subjects/:subjectId/topics', component: TopicsWithQuiz }, { path: '/:any(.*)*', component: { render: () => null } }] })
    await router.push('/subjects/s-1/topics')

    const wrapper = mount({ render: () => h(RouterView) }, { global: { plugins: [vuetify, i18n, router] } })
    await flushPromises()

    const badge = wrapper.get('[data-testid="topic-tier-t-1"]')
    expect(badge.text()).toContain('Prata · 180 pts')
    expect(badge.attributes('href')).toBe('/subjects/s-1/topics/t-1/progress')
  })

  it('shows staff no tier badges', async () => {
    configureViewer(() => 'teacher')
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/subjects/:subjectId/topics', component: TopicsWithQuiz }] })
    await router.push('/subjects/s-1/topics')

    const wrapper = mount({ render: () => h(RouterView) }, { global: { plugins: [vuetify, i18n, router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="topic-t-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="topic-tier-t-1"]').exists()).toBe(false)
  })

  it('shows no tier rather than a false Ferro when the tiers cannot load', async () => {
    configureViewer(() => 'student')
    progressApi.subjectProgress.mockRejectedValue(new ApiError('system.unexpected_error'))
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/subjects/:subjectId/topics', component: TopicsWithQuiz }, { path: '/:any(.*)*', component: { render: () => null } }] })
    await router.push('/subjects/s-1/topics')

    const wrapper = mount({ render: () => h(RouterView) }, { global: { plugins: [vuetify, i18n, router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="topic-t-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="topic-tier-t-1"]').exists()).toBe(false)
  })

  it('reloads the tiers once queued answers are sent', async () => {
    configureViewer(() => 'student')
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/subjects/:subjectId/topics', component: TopicsWithQuiz }, { path: '/:any(.*)*', component: { render: () => null } }] })
    await router.push('/subjects/s-1/topics')
    mount({ render: () => h(RouterView) }, { global: { plugins: [vuetify, i18n, router] } })
    await flushPromises()
    const quiz = useQuizStore()

    quiz.pendingCount = 1
    await flushPromises()
    quiz.pendingCount = 0
    await flushPromises()

    expect(progressApi.subjectProgress).toHaveBeenCalledTimes(2)
  })
})
