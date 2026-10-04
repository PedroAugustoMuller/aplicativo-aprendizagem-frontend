import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import ClassroomProgressRoute from '@/shared/ui/ClassroomProgressRoute.vue'
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

const vuetify = createVuetify({ components, directives })

describe('ClassroomProgressRoute', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    configureOffline({ userId: () => 'u-1', storage: createMemoryStorage() })
    configureViewerId(() => 'u-1')
    configureViewer(() => 'teacher')
    vi.resetAllMocks()
  })

  it('takes the subject from the classroom and the active topic names from content', async () => {
    classroomsApi.list.mockResolvedValue([{ id: 'c-1', name: '9º A', subjectId: 's-1', teacherIds: [], studentCount: 1, active: true }])
    classroomsApi.subjectOptions.mockResolvedValue([])
    topicsApi.listBySubject.mockResolvedValue([
      { id: 't-1', name: 'Átomos', description: '', position: 0, active: true, questionCount: 3 },
      { id: 't-2', name: 'Antigo', description: '', position: 1, active: false, questionCount: 0 },
    ])
    progressApi.classroomProgress.mockResolvedValue([{ id: 'u-1', name: 'Carla', username: 'carla.dias', topics: [] }])
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/classrooms/:classroomId/progress', component: ClassroomProgressRoute }, { path: '/:any(.*)*', component: { render: () => null } }] })
    await router.push('/classrooms/c-1/progress')

    const wrapper = mount({ render: () => h(RouterView) }, { global: { plugins: [vuetify, i18n, router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Desempenho da turma')
    expect(wrapper.text()).toContain('9º A')
    expect(topicsApi.listBySubject).toHaveBeenCalledWith('s-1')
    expect(wrapper.find('[data-testid="classroom-progress-cell-u-1-t-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="classroom-progress-cell-u-1-t-2"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="classroom-progress-back"]').attributes('href')).toBe('/classrooms/c-1')
  })
})
