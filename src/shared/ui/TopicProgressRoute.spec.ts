import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import TopicProgressRoute from '@/shared/ui/TopicProgressRoute.vue'
import { configureViewer, configureViewerId } from '@/shared/auth/viewer'
import { configureOffline } from '@/shared/offline/readThrough'
import { createMemoryStorage } from '@/shared/offline/storage'
import { i18n } from '@/shared/i18n'

// shared/ui reaches modules only through application/ and presentation/: mock by path.
const topicsApi = vi.hoisted(() => ({ listBySubject: vi.fn() }))
vi.mock('@/modules/content/infrastructure/HttpTopicRepository', () => ({ topicRepository: topicsApi }))
const classroomsApi = vi.hoisted(() => ({ list: vi.fn(), subjectOptions: vi.fn() }))
vi.mock('@/modules/identity/infrastructure/HttpClassroomRepository', () => ({ classroomRepository: classroomsApi }))
const progressApi = vi.hoisted(() => ({ subjectProgress: vi.fn(), topicHistory: vi.fn(), wrongQuestions: vi.fn(), attempt: vi.fn(), classroomProgress: vi.fn() }))
vi.mock('@/modules/quiz/infrastructure/HttpProgressRepository', () => ({ progressRepository: progressApi }))
vi.mock('@/modules/quiz/infrastructure/HttpQuizRepository', () => ({ quizRepository: { start: vi.fn(), get: vi.fn(), answer: vi.fn() } }))

const vuetify = createVuetify({ components, directives })

async function renderAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/subjects/:subjectId/topics/:topicId/progress', component: TopicProgressRoute },
      { path: '/classrooms/:classroomId/students/:studentId/topics/:topicId/progress', component: TopicProgressRoute },
      { path: '/:any(.*)*', component: { render: () => null } },
    ],
  })
  await router.push(path)
  const wrapper = mount({ render: () => h(RouterView) }, { global: { plugins: [vuetify, i18n, router] } })
  await flushPromises()

  return wrapper
}

describe('TopicProgressRoute', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    configureOffline({ userId: () => 'u-1', storage: createMemoryStorage() })
    configureViewerId(() => 'u-1')
    vi.resetAllMocks()
    topicsApi.listBySubject.mockResolvedValue([{ id: 't-1', name: 'Átomos', description: '', position: 0, active: true, questionCount: null }])
    progressApi.topicHistory.mockResolvedValue({ points: 0, tier: 'iron', nextTier: { tier: 'bronze', points: 50 }, attempts: [] })
    progressApi.wrongQuestions.mockResolvedValue([])
  })

  it('names the topic from content for the student own page', async () => {
    configureViewer(() => 'student')
    const wrapper = await renderAt('/subjects/s-1/topics/t-1/progress')

    expect(wrapper.get('[data-testid="progress-title"]').text()).toBe('Átomos')
    expect(topicsApi.listBySubject).toHaveBeenCalledWith('s-1')
    expect(progressApi.topicHistory).toHaveBeenCalledWith({ kind: 'own' }, 't-1')
    expect(wrapper.get('[data-testid="progress-back"]').attributes('href')).toBe('/subjects/s-1/topics')
  })

  it('finds the subject through the classroom and the student name through the grid for staff', async () => {
    configureViewer(() => 'teacher')
    classroomsApi.list.mockResolvedValue([{ id: 'c-1', name: '9º A', subjectId: 's-1', teacherIds: [], studentCount: 1, active: true }])
    classroomsApi.subjectOptions.mockResolvedValue([])
    progressApi.classroomProgress.mockResolvedValue([{ id: 'u-1', name: 'Carla', username: 'carla.dias', topics: [] }])
    const wrapper = await renderAt('/classrooms/c-1/students/u-1/topics/t-1/progress')

    expect(wrapper.text()).toContain('Desempenho de Carla')
    expect(wrapper.get('[data-testid="progress-title"]').text()).toBe('Átomos')
    expect(progressApi.topicHistory).toHaveBeenCalledWith({ kind: 'student', classroomId: 'c-1', studentId: 'u-1' }, 't-1')
    expect(wrapper.get('[data-testid="progress-back"]').attributes('href')).toBe('/classrooms/c-1/progress')
  })
})
