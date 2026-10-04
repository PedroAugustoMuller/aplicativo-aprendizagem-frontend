import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView, type RouteRecordRaw } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { i18n } from '@/shared/i18n'
import AttemptReviewPage from '@/modules/quiz/presentation/AttemptReviewPage.vue'
import { configureOffline } from '@/shared/offline/readThrough'
import { createMemoryStorage } from '@/shared/offline/storage'
import { configureViewerId } from '@/shared/auth/viewer'
import type { Attempt } from '@/modules/quiz/domain/Attempt'

const repo = vi.hoisted(() => ({ subjectProgress: vi.fn(), topicHistory: vi.fn(), wrongQuestions: vi.fn(), attempt: vi.fn(), classroomProgress: vi.fn() }))
vi.mock('@/modules/quiz/infrastructure/HttpProgressRepository', () => ({ progressRepository: repo }))

const vuetify = createVuetify({ components, directives })

async function renderAt(path: string, routes: RouteRecordRaw[]) {
  const router = createRouter({ history: createMemoryHistory(), routes: [...routes, { path: '/:any(.*)*', component: { render: () => null } }] })
  await router.push(path)
  const wrapper = mount({ render: () => h(RouterView) }, { global: { plugins: [vuetify, i18n, router] } })
  await flushPromises()

  return { wrapper, router }
}

const ATTEMPT: Attempt = {
  id: 'a-1', topicId: 't-1', startedAt: 's', completedAt: 'c', score: { total: 1, answered: 1, correct: 0 },
  questions: [{
    id: 'q1', position: 0, type: 'multiple_choice', statement: 'Sódio?', options: [{ id: 'na', text: 'Na' }, { id: 's', text: 'S' }],
    result: { questionId: 'q1', optionId: 's', correct: false, correctOptionId: 'na', explanation: 'Natrium.' },
  }],
}

const ROUTES = [
  { path: '/quiz/:attemptId/review', component: AttemptReviewPage },
  { path: '/classrooms/:classroomId/students/:studentId/quiz/:attemptId/review', component: AttemptReviewPage },
]

describe('AttemptReviewPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    configureOffline({ userId: () => 'u-1', storage: createMemoryStorage() })
    configureViewerId(() => 'u-1')
    repo.attempt.mockReset().mockResolvedValue(ATTEMPT)
  })

  it('shows the student their answers, the right ones and the explanation', async () => {
    const { wrapper } = await renderAt('/quiz/a-1/review', ROUTES)

    expect(repo.attempt).toHaveBeenCalledWith({ kind: 'own' }, 'a-1')
    expect(wrapper.text()).toContain('Revisão do quiz')
    const row = wrapper.get('[data-testid="quiz-result-0"]')
    await row.get('.v-expansion-panel-title').trigger('click')
    await flushPromises()
    expect(row.text()).toContain('Sódio?')
    expect(row.text()).toContain('Sua resposta: S')
    expect(row.text()).toContain('Resposta certa: Na')
  })

  it('reads a classroom student attempt for staff', async () => {
    const { wrapper } = await renderAt('/classrooms/c-1/students/u-9/quiz/a-1/review', ROUTES)

    expect(repo.attempt).toHaveBeenCalledWith({ kind: 'student', classroomId: 'c-1', studentId: 'u-9' }, 'a-1')
    await wrapper.get('[data-testid="quiz-result-0"] .v-expansion-panel-title').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="quiz-result-0"]').text()).toContain('Resposta do aluno: S')
  })
})
