import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import CredentialsPage from '@/modules/identity/presentation/CredentialsPage.vue'
import { configureOffline } from '@/shared/offline/readThrough'
import { createMemoryStorage } from '@/shared/offline/storage'
import { i18n } from '@/shared/i18n'

const students = vi.hoisted(() => ({
  listByClassroom: vi.fn(), createMany: vi.fn(), unenrol: vi.fn(), resetPassword: vi.fn(), setActive: vi.fn(), credentials: vi.fn(),
}))
const classrooms = vi.hoisted(() => ({
  list: vi.fn(), subjectOptions: vi.fn(), create: vi.fn(), update: vi.fn(), assignTeachers: vi.fn(), deactivate: vi.fn(),
}))
vi.mock('@/modules/identity/infrastructure/HttpStudentRepository', () => ({ studentRepository: students }))
vi.mock('@/modules/identity/infrastructure/HttpClassroomRepository', () => ({ classroomRepository: classrooms }))

const vuetify = createVuetify({ components, directives })
const App = { render: () => h(RouterView) }

async function render() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/classrooms/:classroomId/credentials', component: CredentialsPage }],
  })
  await router.push('/classrooms/c-1/credentials')
  const wrapper = mount(App, { global: { plugins: [vuetify, i18n, router] } })
  await flushPromises()

  return wrapper
}

describe('CredentialsPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    configureOffline({ userId: () => 'u-1', storage: createMemoryStorage() })
    classrooms.list.mockResolvedValue([
      { id: 'c-1', name: 'Química 1', subjectId: 's-1', teacherIds: [], studentCount: 1, active: true },
    ])
    classrooms.subjectOptions.mockResolvedValue([])
  })

  it('prints one card per pending access', async () => {
    students.credentials.mockResolvedValue([
      { userId: 's-1', name: 'Ana Lima', username: 'ana.lima', temporaryPassword: 'Abc23456' },
    ])
    // happy-dom has no window.print; the page calls globalThis.print().
    const print = vi.fn()
    vi.stubGlobal('print', print)

    const wrapper = await render()
    const card = wrapper.find('[data-testid="credential-s-1"]')

    expect(wrapper.find('[data-testid="credentials-title"]').text()).toBe('Acessos — Química 1')
    expect(card.text()).toContain('Ana Lima')
    expect(card.text()).toContain('ana.lima')
    expect(card.text()).toContain('Abc23456')
    expect(card.text()).toContain(window.location.origin)

    await wrapper.find('[data-testid="credentials-print"]').trigger('click')
    expect(print).toHaveBeenCalled()
  })

  it('says when nothing is pending', async () => {
    students.credentials.mockResolvedValue([])

    const wrapper = await render()

    expect(wrapper.find('[data-testid="credentials-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="credentials-print"]').attributes('disabled')).toBeDefined()
  })
})
