import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import AppLayout from '@/shared/ui/AppLayout.vue'
import { useSessionStore } from '@/modules/identity/application/sessionStore'
import { i18n } from '@/shared/i18n'

const vuetify = createVuetify({ components, directives })
const Stub = { render: () => null }

function buildRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/classrooms', component: Stub },
      { path: '/teachers', component: Stub },
      { path: '/subjects', component: Stub },
      { path: '/my-classrooms', component: Stub },
      { path: '/change-password', component: Stub },
    ],
  })
}

// Vuetify's `mobile` composable reads window.innerWidth once at plugin
// creation and again on every 'resize' event - forcing a phone width here (and
// firing resize) makes the bottom-navigation branch deterministic regardless
// of happy-dom's own default viewport.
function setMobileViewport(): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 })
  window.dispatchEvent(new Event('resize'))
}

async function render(startPath: string): Promise<ReturnType<typeof mount>> {
  const router = buildRouter()
  await router.push(startPath)
  return mount(AppLayout, { global: { plugins: [vuetify, i18n, router] } })
}

describe('AppLayout', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    setMobileViewport()
  })

  afterEach(() => {
    i18n.global.locale.value = 'pt-BR'
  })

  it('gives a teacher (a single nav tab) a permanent bottom navigation on mobile', async () => {
    const session = useSessionStore()
    session.token = 'token-teacher'
    session.user = { userId: 't-1', name: 'Bruno', login: 'bruno@escola.br', role: 'teacher', mustChangePassword: false }

    const wrapper = await render('/classrooms')

    expect(wrapper.find('.v-bottom-navigation').exists()).toBe(true)
    expect(wrapper.find('[data-testid="nav-classrooms"]').exists()).toBe(true)
  })

  it('gives a student (a single nav tab) a permanent bottom navigation on mobile', async () => {
    const session = useSessionStore()
    session.token = 'token-student'
    session.user = { userId: 's-1', name: 'Carla', login: 'carla.dias', role: 'student', mustChangePassword: false }

    const wrapper = await render('/my-classrooms')

    expect(wrapper.find('.v-bottom-navigation').exists()).toBe(true)
    expect(wrapper.find('[data-testid="nav-my-classrooms"]').exists()).toBe(true)
  })

  it('hides the bottom navigation while a password change is pending, even on mobile', async () => {
    const session = useSessionStore()
    session.token = 'token-student'
    session.user = { userId: 's-1', name: 'Carla', login: 'carla.dias', role: 'student', mustChangePassword: true }

    const wrapper = await render('/change-password')

    expect(wrapper.find('.v-bottom-navigation').exists()).toBe(false)
  })

  it('renders no bottom navigation bar at all while the role is still unknown', async () => {
    // A token exists (hasSession) but restore() has not resolved yet - e.g. an
    // offline reload of the installed PWA. navigationFor(null) returns [], so
    // there is nothing to show a permanent bottom bar FOR; an empty bar would
    // be worse than none.
    const session = useSessionStore()
    session.token = 'token-unknown-role'

    const wrapper = await render('/classrooms')

    expect(wrapper.find('.v-bottom-navigation').exists()).toBe(false)
  })
})
