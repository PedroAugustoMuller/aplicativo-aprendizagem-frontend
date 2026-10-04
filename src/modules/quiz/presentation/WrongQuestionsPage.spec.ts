import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView, type RouteRecordRaw } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { i18n } from '@/shared/i18n'
import WrongQuestionsPage from '@/modules/quiz/presentation/WrongQuestionsPage.vue'
import { configureOffline } from '@/shared/offline/readThrough'
import { createMemoryStorage } from '@/shared/offline/storage'
import { configureViewerId } from '@/shared/auth/viewer'
import { EMPTY_HISTORY } from '@/modules/quiz/domain/Progress'

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

const ROUTES = [
  { path: '/subjects/:subjectId/topics/:topicId/review', component: WrongQuestionsPage },
  { path: '/classrooms/:classroomId/students/:studentId/topics/:topicId/review', component: WrongQuestionsPage },
]
const WRONG = [{
  questionId: 'q1', type: 'multiple_choice' as const, statement: 'Sódio?', options: [{ id: 'na', text: 'Na' }, { id: 's', text: 'S' }],
  chosenOptionId: 's', correctOptionId: 'na', explanation: 'Natrium.', answeredAt: 'x',
}]

describe('WrongQuestionsPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    configureOffline({ userId: () => 'u-1', storage: createMemoryStorage() })
    configureViewerId(() => 'u-1')
    repo.topicHistory.mockReset().mockResolvedValue(EMPTY_HISTORY)
    repo.wrongQuestions.mockReset()
  })

  it('lists the wrong questions with the right answer and the explanation', async () => {
    repo.wrongQuestions.mockResolvedValue(WRONG)
    const { wrapper } = await renderAt('/subjects/s-1/topics/t-1/review', ROUTES)

    const card = wrapper.get('[data-testid="wrong-question-0"]')
    expect(card.text()).toContain('Sódio?')
    expect(card.text()).toContain('Você respondeu: S')
    expect(card.text()).toContain('Resposta certa: Na')
    expect(card.text()).toContain('Natrium.')
    expect(wrapper.text()).toContain('Questões para revisar')
    expect(repo.wrongQuestions).toHaveBeenCalledWith({ kind: 'own' }, 't-1')
  })

  it('says well done when nothing is wrong', async () => {
    repo.wrongQuestions.mockResolvedValue([])
    const { wrapper } = await renderAt('/subjects/s-1/topics/t-1/review', ROUTES)

    expect(wrapper.get('[data-testid="wrong-empty"]').text()).toBe('Nenhuma questão errada para revisar. Muito bem!')
  })

  it('shows staff the student answer', async () => {
    repo.wrongQuestions.mockResolvedValue(WRONG)
    const { wrapper } = await renderAt('/classrooms/c-1/students/u-9/topics/t-1/review', ROUTES)

    expect(wrapper.get('[data-testid="wrong-question-0"]').text()).toContain('Resposta do aluno: S')
    expect(repo.wrongQuestions).toHaveBeenCalledWith({ kind: 'student', classroomId: 'c-1', studentId: 'u-9' }, 't-1')
  })
})
