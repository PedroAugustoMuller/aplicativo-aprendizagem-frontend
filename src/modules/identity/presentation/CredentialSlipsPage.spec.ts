import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import CredentialSlipsPage from '@/modules/identity/presentation/CredentialSlipsPage.vue'
import { useRosterStore } from '@/modules/identity/application/rosterStore'
import { i18n } from '@/shared/i18n'
import { ApiError } from '@/shared/api/error'

// dependency-cruiser forbids presentation/ from reaching infrastructure/, even
// in a spec, so the repository is never imported here - the store (which the
// page actually talks to) is spied on instead, exactly like TeachersPage.spec.ts.
// A real router (rather than a static vue-router mock) is used so the
// route-param-changed reload (see F2) can be exercised with an actual navigation.

const vuetify = createVuetify({ components, directives })

let wrapper: VueWrapper | null = null
let store: ReturnType<typeof useRosterStore>
let originalPrint: typeof globalThis.print | undefined

const find = (selector: string) => new DOMWrapper(document.body).find(selector)

function buildRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/classrooms/:classroomId/credentials', component: CredentialSlipsPage }],
  })
}

async function render(classroomId = 'c-1'): Promise<{ wrapper: VueWrapper; router: Router }> {
  const router = buildRouter()
  await router.push(`/classrooms/${classroomId}/credentials`)
  wrapper = mount(CredentialSlipsPage, { attachTo: document.body, global: { plugins: [vuetify, i18n, router] } })
  return { wrapper, router }
}

describe('CredentialSlipsPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    store = useRosterStore()
    vi.spyOn(store, 'loadSlips').mockResolvedValue()
    originalPrint = globalThis.print
  })

  afterEach(() => {
    i18n.global.locale.value = 'pt-BR'
    wrapper?.unmount()
    wrapper = null
    // happy-dom's Window does not implement print(), so the print-button test
    // below assigns it directly rather than vi.spyOn - undo that assignment
    // instead of leaving a stub attached once the file finishes.
    if (originalPrint === undefined) {
      Reflect.deleteProperty(globalThis, 'print')
    } else {
      globalThis.print = originalPrint
    }
  })

  it('loads the slips for the classroom in the route', async () => {
    await render('c-1')

    expect(store.loadSlips).toHaveBeenCalledWith('c-1')
  })

  it('reloads the slips for the new classroom when the route param changes without remounting', async () => {
    const { router } = await render('c-1')
    await vi.waitFor(() => expect(store.loadSlips).toHaveBeenCalledWith('c-1'))
    vi.mocked(store.loadSlips).mockClear()

    // vue-router reuses this component instance across a param-only navigation,
    // exactly like moving from one classroom's credential slips to another's.
    await router.push('/classrooms/c-2/credentials')

    expect(store.loadSlips).toHaveBeenCalledWith('c-2')
    expect(store.loadSlips).not.toHaveBeenCalledWith('c-1')
  })

  it('renders one slip per pending student with name, login and password', async () => {
    store.slips = [{ userId: 'u-1', name: 'Carla Dias', login: 'carla.dias', temporaryPassword: 'Temp1234' }]

    await render()
    await vi.waitFor(() => expect(find('[data-testid="slips-grid"]').exists()).toBe(true))

    const slip = find('[data-testid="slip-u-1"]')
    expect(slip.text()).toContain('Carla Dias')
    expect(slip.text()).toContain('carla.dias')
    expect(slip.text()).toContain('Temp1234')
  })

  it('shows the empty state when every student in the classroom has already changed their password', async () => {
    store.slips = []

    await render()
    await vi.waitFor(() => expect(find('[data-testid="slips-empty"]').exists()).toBe(true))
  })

  it('shows the translated error and no grid when loading fails', async () => {
    store.error = new ApiError('api.network_unavailable')

    await render()
    await vi.waitFor(() => expect(find('[data-testid="slips-error"]').exists()).toBe(true))

    expect(find('[data-testid="slips-grid"]').exists()).toBe(false)
    expect(find('[data-testid="slips-empty"]').exists()).toBe(false)
  })

  it('retries loadSlips when the retry button on the error alert is clicked', async () => {
    store.error = new ApiError('api.network_unavailable')

    await render()
    await vi.waitFor(() => expect(find('[data-testid="slips-error"]').exists()).toBe(true))
    vi.mocked(store.loadSlips).mockClear()

    await find('[data-testid="slips-retry"]').trigger('click')

    expect(store.loadSlips).toHaveBeenCalledWith('c-1')
  })

  it('hides the retry button on a 404 (a classroom that no longer exists)', async () => {
    store.error = new ApiError('identity.classroom_not_found', {}, 404)

    await render()
    await vi.waitFor(() => expect(find('[data-testid="slips-error"]').exists()).toBe(true))

    expect(find('[data-testid="slips-retry"]').exists()).toBe(false)
  })

  it('the print button calls window.print and is disabled with no slips', async () => {
    const printSpy = vi.fn()
    globalThis.print = printSpy

    await render()
    await vi.waitFor(() => expect(find('[data-testid="slips-empty"]').exists()).toBe(true))
    expect(find('[data-testid="slips-print"]').attributes('disabled')).toBeDefined()

    store.slips = [{ userId: 'u-1', name: 'Carla Dias', login: 'carla.dias', temporaryPassword: 'Temp1234' }]
    await vi.waitFor(() => expect(find('[data-testid="slips-grid"]').exists()).toBe(true))

    await find('[data-testid="slips-print"]').trigger('click')
    expect(printSpy).toHaveBeenCalled()
  })
})
