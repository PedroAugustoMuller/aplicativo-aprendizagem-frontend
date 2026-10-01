import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import AppLayout from '@/shared/ui/AppLayout.vue'
import { useSessionStore } from '@/modules/identity/application/sessionStore'
import { useSubjectStore } from '@/modules/content/application/subjectStore'
import { useTopicStore } from '@/modules/content/application/topicStore'
import { i18n } from '@/shared/i18n'
import { configureOffline, readThrough } from '@/shared/offline/readThrough'
import { createMemoryStorage } from '@/shared/offline/storage'

// shared/ui may reach a module only through application/ and presentation/, so
// the repository is mocked by path rather than imported.
vi.mock('@/modules/identity/infrastructure/HttpAuthRepository', () => ({
  authRepository: { login: vi.fn(), logout: vi.fn(), currentUser: vi.fn(), changePassword: vi.fn() },
}))
vi.mock('@/modules/content/infrastructure/HttpSubjectRepository', () => ({ subjectRepository: { list: vi.fn() } }))
vi.mock('@/modules/content/infrastructure/HttpTopicRepository', () => ({ topicRepository: { listBySubject: vi.fn() } }))

const vuetify = createVuetify({ components, directives })
const Stub = defineComponent({ render: () => null })

async function render() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:any(.*)*', component: Stub }] })
  await router.push('/subjects')

  const wrapper = mount(AppLayout, { global: { plugins: [vuetify, i18n, router] } })
  await flushPromises()

  return wrapper
}

const user = (mustChangePassword: boolean) => ({
  userId: 'u-1', name: 'Ana', login: 'ana@escola.br', role: 'admin', mustChangePassword,
}) as const

describe('AppLayout', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('shows the navigation to a signed-in user', async () => {
    useSessionStore().$patch({ token: 'tok', user: user(false) })

    const wrapper = await render()

    // happy-dom's default 1024px viewport is under Vuetify's mobile breakpoint
    // (lg), so which nav useDisplay() picks is not the point here - that one does.
    const nav = wrapper.find('.v-navigation-drawer').exists() || wrapper.find('.v-bottom-navigation').exists()
    expect(nav).toBe(true)
    expect(wrapper.find('[data-testid="sign-out"]').exists()).toBe(true)
  })

  it('hides the navigation, but not sign-out, while a password change is pending', async () => {
    useSessionStore().$patch({ token: 'tok', user: user(true) })

    const wrapper = await render()

    expect(wrapper.find('.v-navigation-drawer').exists()).toBe(false)
    expect(wrapper.find('.v-bottom-navigation').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sign-out"]').exists()).toBe(true)
  })

  it('forgets the previous user\'s content when the session ends', async () => {
    useSessionStore().$patch({ token: 'tok', user: user(false) })
    useSubjectStore().$patch({ subjects: [{ id: 's-1', name: 'Química', active: true }] })
    useTopicStore().$patch({ subjectId: 's-1', topics: [{ id: 't-1', name: 'Átomos', description: 'x', position: 1 }] })
    await render()

    useSessionStore().clear()
    await nextTick()

    expect(useSubjectStore().subjects).toEqual([])
    expect(useTopicStore().topics).toEqual([])
    expect(useTopicStore().subjectId).toBeNull()
  })

  it('wipes the previous user\'s saved lists from this phone when the session ends', async () => {
    const storage = createMemoryStorage()
    const session = useSessionStore()
    configureOffline({ userId: () => session.knownUser?.userId ?? null, storage })
    session.$patch({ token: 'tok', user: user(false) })
    await readThrough('identity:teachers', async () => ['Bruno'])
    await render()

    session.clear()
    await flushPromises()

    expect(await storage.keys()).toEqual([])
  })
})
