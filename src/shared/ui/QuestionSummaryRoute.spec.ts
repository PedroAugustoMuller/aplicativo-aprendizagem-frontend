import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import QuestionSummaryRoute from '@/shared/ui/QuestionSummaryRoute.vue'
import { configureViewer, configureViewerId } from '@/shared/auth/viewer'
import { configureOffline } from '@/shared/offline/readThrough'
import { createMemoryStorage } from '@/shared/offline/storage'
import { i18n } from '@/shared/i18n'

// shared/ui reaches modules only through application/ and presentation/: mock by path.
const topicsApi = vi.hoisted(() => ({ listBySubject: vi.fn() }))
vi.mock('@/modules/content/infrastructure/HttpTopicRepository', () => ({ topicRepository: topicsApi }))
const classroomsApi = vi.hoisted(() => ({ list: vi.fn(), subjectOptions: vi.fn() }))
vi.mock('@/modules/identity/infrastructure/HttpClassroomRepository', () => ({ classroomRepository: classroomsApi }))
const progressApi = vi.hoisted(() => ({
  subjectProgress: vi.fn(), topicHistory: vi.fn(), wrongQuestions: vi.fn(), attempt: vi.fn(), classroomProgress: vi.fn(), questionSummary: vi.fn(),
}))
vi.mock('@/modules/quiz/infrastructure/HttpProgressRepository', () => ({ progressRepository: progressApi }))

const vuetify = createVuetify({ components, directives })

async function renderAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/classrooms/:classroomId/topics/:topicId/questions', component: QuestionSummaryRoute }, { path: '/:any(.*)*', component: { render: () => null } }],
  })
  await router.push(path)
  const wrapper = mount({ render: () => h(RouterView) }, { global: { plugins: [vuetify, i18n, router] } })
  await flushPromises()

  return { wrapper, router }
}

describe('QuestionSummaryRoute', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    configureOffline({ userId: () => 'u-1', storage: createMemoryStorage() })
    configureViewerId(() => 'u-1')
    configureViewer(() => 'teacher')
    vi.resetAllMocks()
    classroomsApi.list.mockResolvedValue([{ id: 'c-1', name: '9º A', subjectId: 's-1', teacherIds: [], studentCount: 1, active: true }])
    classroomsApi.subjectOptions.mockResolvedValue([])
    topicsApi.listBySubject.mockResolvedValue([{ id: 't-1', name: 'Tabela Periódica', description: '', position: 0, active: true, questionCount: 3 }])
    progressApi.questionSummary.mockResolvedValue({ students: 1, questions: [] })
  })

  it('names the topic and the classroom, and goes back to the grid', async () => {
    const { wrapper } = await renderAt('/classrooms/c-1/topics/t-1/questions')

    expect(wrapper.text()).toContain('Questões de Tabela Periódica')
    expect(wrapper.get('[data-testid="question-summary-scope-classroom"]').text()).toBe('9º A')
    expect(topicsApi.listBySubject).toHaveBeenCalledWith('s-1')
    expect(progressApi.questionSummary).toHaveBeenCalledWith({ kind: 'classroom', classroomId: 'c-1' }, 't-1')
    expect(wrapper.get('[data-testid="question-summary-back"]').attributes('href')).toBe('/classrooms/c-1/progress')
  })

  it('keeps the scope in the URL', async () => {
    const { wrapper, router } = await renderAt('/classrooms/c-1/topics/t-1/questions?scope=all')

    expect(progressApi.questionSummary).toHaveBeenCalledWith({ kind: 'subject' }, 't-1')
    expect(wrapper.get('[data-testid="question-summary-scope-all"]').text()).toBe('Todas as minhas turmas')

    await wrapper.get('[data-testid="question-summary-scope-classroom"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({})
    expect(progressApi.questionSummary).toHaveBeenLastCalledWith({ kind: 'classroom', classroomId: 'c-1' }, 't-1')

    await wrapper.get('[data-testid="question-summary-scope-all"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ scope: 'all' })
  })

  it('tells an admin the switch covers the whole subject', async () => {
    configureViewer(() => 'admin')
    const { wrapper } = await renderAt('/classrooms/c-1/topics/t-1/questions')

    expect(wrapper.get('[data-testid="question-summary-scope-all"]').text()).toBe('Todas as turmas da matéria')
  })
})
