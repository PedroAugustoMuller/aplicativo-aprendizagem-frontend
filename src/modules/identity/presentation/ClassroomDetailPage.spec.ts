import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import ClassroomDetailPage from '@/modules/identity/presentation/ClassroomDetailPage.vue'
import { useRosterStore } from '@/modules/identity/application/rosterStore'
import { useClassroomStore } from '@/modules/identity/application/classroomStore'
import { i18n } from '@/shared/i18n'
import { ApiError } from '@/shared/api/error'

// This spec is deliberately scoped (see F4 in the fix wave) to the two things
// the whole-branch review flagged for this page: the route-param watch (F2)
// re-loading the roster on a param-only navigation, and a row action's
// failure surfacing in the error snackbar. It does not attempt full coverage.

// identity/ may never import another module, so content's subjectStore (which
// SubjectLabel depends on) is faked through vi.mock's string path, exactly as
// ClassroomsPage.spec.ts does.
vi.mock('@/modules/content/application/subjectStore', () => ({
  useSubjectStore: () => ({
    nameOf: (id: string) => (id === 's-1' ? 'Química' : null),
    ensureLoaded: vi.fn().mockResolvedValue(undefined),
  }),
}))

const vuetify = createVuetify({ components, directives })
const Stub = { render: () => null }

let wrapper: VueWrapper | null = null
let roster: ReturnType<typeof useRosterStore>
let classroomStore: ReturnType<typeof useClassroomStore>

// v-dialog/v-menu teleport their content to document.body, outside
// wrapper.element, so lookups go through the body rather than the mounted wrapper.
const find = (selector: string) => new DOMWrapper(document.body).find(selector)

// The desktop (non-mobile) row actions are plain buttons; the mobile layout
// hides the same actions behind a kebab menu with no test id on its
// activator. Forcing a desktop width keeps this scoped spec's row-action test
// simple, since which layout renders is not what F4 is about.
function setDesktopViewport(): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1920 })
  window.dispatchEvent(new Event('resize'))
}

function buildRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/classrooms/:classroomId', component: ClassroomDetailPage },
      { path: '/classrooms/:classroomId/credentials', component: Stub },
    ],
  })
}

async function render(classroomId = 'c-1'): Promise<{ wrapper: VueWrapper; router: Router }> {
  const router = buildRouter()
  await router.push(`/classrooms/${classroomId}`)
  wrapper = mount(ClassroomDetailPage, { attachTo: document.body, global: { plugins: [vuetify, i18n, router] } })
  return { wrapper, router }
}

describe('ClassroomDetailPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    setDesktopViewport()
    roster = useRosterStore()
    classroomStore = useClassroomStore()
    vi.spyOn(classroomStore, 'load').mockResolvedValue()
    classroomStore.classrooms = [
      { id: 'c-1', name: 'Química 1', subjectId: 's-1', teacherIds: ['t-1'], studentCount: 1, active: true },
      { id: 'c-2', name: 'Química 2', subjectId: 's-1', teacherIds: ['t-1'], studentCount: 1, active: true },
    ]
  })

  afterEach(() => {
    i18n.global.locale.value = 'pt-BR'
    wrapper?.unmount()
    wrapper = null
  })

  it('loads the roster for the classroom in the route', async () => {
    const load = vi.spyOn(roster, 'load').mockResolvedValue()

    await render('c-1')

    expect(load).toHaveBeenCalledWith('c-1')
  })

  it('reloads the roster for the new classroom when the route param changes without remounting', async () => {
    const load = vi.spyOn(roster, 'load').mockResolvedValue()
    const { router } = await render('c-1')
    await vi.waitFor(() => expect(load).toHaveBeenCalledWith('c-1'))
    load.mockClear()

    // vue-router reuses this component instance across a param-only
    // navigation, exactly like a teacher moving from one classroom's roster
    // straight to another's.
    await router.push('/classrooms/c-2')

    expect(load).toHaveBeenCalledWith('c-2')
    expect(load).not.toHaveBeenCalledWith('c-1')
  })

  it('shows a rejected row action in the error snackbar', async () => {
    roster.classroomId = 'c-1'
    roster.students = [{ id: 'st-1', name: 'Carla', login: 'carla.dias', mustChangePassword: false, active: true }]
    vi.spyOn(roster, 'load').mockResolvedValue()
    vi.spyOn(roster, 'resetPassword').mockRejectedValue(new ApiError('identity.student_not_found', {}, 404))

    await render('c-1')
    await vi.waitFor(() => expect(find('[data-testid="roster-list"]').exists()).toBe(true))

    await find('[data-testid="student-reset-st-1"]').trigger('click')
    await find('[data-testid="roster-action-confirm"]').trigger('click')

    await vi.waitFor(() => expect(find('[data-testid="roster-row-error"]').text()).toContain('Aluno não encontrado.'))
  })
})
