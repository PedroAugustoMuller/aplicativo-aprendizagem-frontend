import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import ClassroomProgressPanel from '@/modules/quiz/presentation/ClassroomProgressPanel.vue'
import { configureOffline } from '@/shared/offline/readThrough'
import { createMemoryStorage } from '@/shared/offline/storage'
import { configureViewerId } from '@/shared/auth/viewer'
import { i18n } from '@/shared/i18n'

const repo = vi.hoisted(() => ({ subjectProgress: vi.fn(), topicHistory: vi.fn(), wrongQuestions: vi.fn(), attempt: vi.fn(), classroomProgress: vi.fn() }))
vi.mock('@/modules/quiz/infrastructure/HttpProgressRepository', () => ({ progressRepository: repo }))

const TOPICS = [{ id: 't-1', name: 'Tabela Periódica' }, { id: 't-2', name: 'Átomos' }]

/** Vuetify reads the window width when it is created. */
async function render(width: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true })
  const vuetify = createVuetify({ components, directives })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:any(.*)*', component: { render: () => null } }] })
  await router.push('/')
  const wrapper = mount(ClassroomProgressPanel, {
    props: { classroomId: 'c-1', classroomName: '9º A', topics: TOPICS },
    global: { plugins: [vuetify, i18n, router] },
  })
  await flushPromises()

  return wrapper
}

describe('ClassroomProgressPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    configureOffline({ userId: () => 'u-1', storage: createMemoryStorage() })
    configureViewerId(() => 'u-1')
    repo.classroomProgress.mockReset().mockResolvedValue([{ id: 'u-1', name: 'Carla', username: 'carla.dias', topics: [{ topicId: 't-1', points: 60, tier: 'bronze' }] }])
  })

  it.each([[1280, 'classroom-progress-table'], [375, 'classroom-progress-list']])('at %ipx shows each student against each topic, iron where there are no answers', async (width, layout) => {
    const wrapper = await render(width)

    expect(wrapper.find(`[data-testid="${layout}"]`).exists()).toBe(true)
    expect(wrapper.text()).toContain('Carla')
    expect(wrapper.text()).toContain('Átomos')
    const cell = wrapper.get('[data-testid="classroom-progress-cell-u-1-t-1"]')
    expect(cell.text()).toContain('Bronze · 60 pts')
    expect(cell.attributes('href')).toBe('/classrooms/c-1/students/u-1/topics/t-1/progress')
    expect(wrapper.get('[data-testid="classroom-progress-cell-u-1-t-2"]').text()).toContain('Ferro · 0 pts')
    expect(repo.classroomProgress).toHaveBeenCalledWith('c-1')
  })

  it('says when the classroom has no students', async () => {
    repo.classroomProgress.mockResolvedValue([])
    const wrapper = await render(1280)

    expect(wrapper.get('[data-testid="classroom-progress-empty"]').text()).toBe('Nenhum aluno nesta turma.')
  })

  it.each([1280, 375])('at %ipx links each topic to its question summary', async (width) => {
    const wrapper = await render(width)

    for (const topic of TOPICS) {
      const link = wrapper.get(`[data-testid="classroom-progress-topic-${topic.id}"]`)
      expect(link.text()).toContain(topic.name)
      expect(link.attributes('href')).toBe(`/classrooms/c-1/topics/${topic.id}/questions`)
    }
  })
})
