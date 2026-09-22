import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import PasteStudentsDialog from '@/modules/identity/presentation/PasteStudentsDialog.vue'
import { useRosterStore } from '@/modules/identity/application/rosterStore'
import { i18n } from '@/shared/i18n'
import { ApiError } from '@/shared/api/error'

// dependency-cruiser forbids presentation/ from reaching infrastructure/, even
// in a spec, so the repository is faked entirely inside vi.mock's factory
// (never imported directly) - exactly like ClassroomsPage.spec.ts fakes the
// content module's subjectStore. rosterStore itself is the REAL store: this
// spec exercises the dialog's id map and preview together with the store's
// actual createMany/reload behaviour, over a faked HTTP boundary.
const repository = vi.hoisted(() => ({
  listByClassroom: vi.fn(),
  createInClassroom: vi.fn(),
  enrol: vi.fn(),
  unenrol: vi.fn(),
  resetPassword: vi.fn(),
  setActive: vi.fn(),
  credentials: vi.fn(),
}))

vi.mock('@/modules/identity/infrastructure/HttpStudentRepository', () => ({
  studentRepository: repository,
}))

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const vuetify = createVuetify({ components, directives })

let wrapper: VueWrapper | null = null

// v-dialog teleports its content to document.body, outside wrapper.element,
// so lookups go through the body rather than the mounted wrapper.
const find = (selector: string) => new DOMWrapper(document.body).find(selector)
const findAll = (selector: string) => new DOMWrapper(document.body).findAll(selector)

const render = (): VueWrapper => {
  wrapper = mount(PasteStudentsDialog, {
    props: { open: true, classroomId: 'c-1' },
    attachTo: document.body,
    global: { plugins: [vuetify, i18n] },
  })
  return wrapper
}

describe('PasteStudentsDialog', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    repository.listByClassroom.mockResolvedValue([])
    // The dialog's classroomId prop is what matters for this component; the
    // store still needs a loaded classroomId for createMany to know where to post.
    await useRosterStore().load('c-1')
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('shows a chip per name and the duplicate warning, ignoring case and accents', async () => {
    render()

    await find('[data-testid="paste-textarea"] textarea').setValue('Ana Souza\nBia Lima\nana souza')

    expect(findAll('[data-testid="paste-preview"] .v-chip')).toHaveLength(2)
    expect(find('[data-testid="paste-duplicates"]').text()).toBe('Nomes repetidos foram ignorados: Ana Souza')
  })

  it('submits one row per name with a client-generated UUID', async () => {
    repository.createInClassroom.mockResolvedValue([])

    render()
    await find('[data-testid="paste-textarea"] textarea').setValue('Ana Souza\nBia Lima')
    await find('[data-testid="paste-submit"]').trigger('click')
    await vi.waitFor(() => expect(repository.createInClassroom).toHaveBeenCalled())

    const [classroomId, rows] = repository.createInClassroom.mock.calls[0]!
    expect(classroomId).toBe('c-1')
    expect(rows).toHaveLength(2)
    expect(rows.map((row: { name: string }) => row.name)).toEqual(['Ana Souza', 'Bia Lima'])
    for (const row of rows as { id: string }[]) {
      expect(row.id).toMatch(UUID)
    }
  })

  it('resends the identical ids on a retry after a failed submit', async () => {
    repository.createInClassroom
      .mockRejectedValueOnce(new ApiError('api.request_timeout'))
      .mockResolvedValueOnce([])

    render()
    await find('[data-testid="paste-textarea"] textarea').setValue('Ana Souza\nBia Lima')
    await find('[data-testid="paste-submit"]').trigger('click')
    await vi.waitFor(() => expect(find('[data-testid="paste-error"]').exists()).toBe(true))

    await find('[data-testid="paste-submit"]').trigger('click')
    await vi.waitFor(() => expect(repository.createInClassroom).toHaveBeenCalledTimes(2))

    const firstRows = repository.createInClassroom.mock.calls[0]![1]
    const secondRows = repository.createInClassroom.mock.calls[1]![1]
    expect(secondRows).toEqual(firstRows)
  })

  it('disables submit and shows the limit message above the batch cap', async () => {
    const names = Array.from({ length: 51 }, (_, i) => `Aluno ${i + 1}`).join('\n')

    render()
    await find('[data-testid="paste-textarea"] textarea').setValue(names)

    expect(find('[data-testid="paste-over-limit"]').exists()).toBe(true)
    expect(find('[data-testid="paste-submit"]').attributes('disabled')).toBeDefined()
  })

  it('shows the username and temporary password of each created student on success', async () => {
    repository.createInClassroom.mockResolvedValue([
      {
        id: 'whatever-1',
        name: 'Ana Souza',
        login: 'ana.souza',
        role: 'student',
        mustChangePassword: true,
        active: true,
        temporaryPassword: 'Temp1111',
      },
    ])

    render()
    await find('[data-testid="paste-textarea"] textarea').setValue('Ana Souza')
    await find('[data-testid="paste-submit"]').trigger('click')
    await vi.waitFor(() => expect(find('[data-testid="paste-result"]').exists()).toBe(true))

    expect(find('[data-testid="paste-result"]').text()).toContain('ana.souza')
    expect(find('[data-testid="paste-result"]').text()).toContain('Temp1111')
  })
})
