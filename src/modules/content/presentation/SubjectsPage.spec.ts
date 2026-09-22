import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import SubjectsPage from '@/modules/content/presentation/SubjectsPage.vue'
import { useSubjectStore } from '@/modules/content/application/subjectStore'
import { i18n } from '@/shared/i18n'
import { ApiError } from '@/shared/api/error'

// dependency-cruiser forbids presentation/ from reaching infrastructure/, even
// in a spec, so the repository is never imported here - the store (which
// TopicsPage/SubjectsPage actually talk to) is spied on instead, exactly like
// LoginPage.spec.ts does for the identity module.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const vuetify = createVuetify({ components, directives })

let wrapper: VueWrapper | null = null
let store: ReturnType<typeof useSubjectStore>

// v-dialog teleports its content to document.body, outside wrapper.element,
// so lookups go through the body rather than the mounted wrapper.
const find = (selector: string) => new DOMWrapper(document.body).find(selector)

const render = (): VueWrapper => {
  wrapper = mount(SubjectsPage, { attachTo: document.body, global: { plugins: [vuetify, i18n] } })
  return wrapper
}

describe('SubjectsPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    store = useSubjectStore()
    // The page's onMounted calls load(); replace it so tests control the
    // list through store.subjects directly instead of a real HTTP call.
    vi.spyOn(store, 'load').mockResolvedValue()
    store.subjects = [{ id: 's-1', name: 'Química', active: true }]
  })

  afterEach(() => {
    i18n.global.locale.value = 'pt-BR'
    wrapper?.unmount()
    wrapper = null
  })

  it('renders a row per subject', async () => {
    render()
    await vi.waitFor(() => expect(find('[data-testid="subjects-list"]').exists()).toBe(true))

    expect(find('[data-testid="subject-row-s-1"]').text()).toContain('Química')
  })

  it('posts the typed name with a client-generated UUID on create', async () => {
    const create = vi.spyOn(store, 'create').mockResolvedValue({ id: 'whatever', name: 'Biologia', active: true })

    render()
    await vi.waitFor(() => expect(find('[data-testid="subjects-list"]').exists()).toBe(true))

    await find('[data-testid="subjects-create"]').trigger('click')
    await find('[data-testid="subject-name-input"] input').setValue('Biologia')
    await find('[data-testid="subject-save"]').trigger('click')
    await vi.waitFor(() => expect(create).toHaveBeenCalled())

    const [input] = create.mock.calls[0]!
    expect(input.name).toBe('Biologia')
    expect(input.id).toMatch(UUID)
  })

  it('keeps the dialog open and shows the translated conflict message on a 409', async () => {
    vi.spyOn(store, 'create').mockRejectedValue(
      new ApiError('content.subject.name_already_taken', { name: 'Biologia' }, 409),
    )

    render()
    await vi.waitFor(() => expect(find('[data-testid="subjects-list"]').exists()).toBe(true))

    await find('[data-testid="subjects-create"]').trigger('click')
    await find('[data-testid="subject-name-input"] input').setValue('Biologia')
    await find('[data-testid="subject-save"]').trigger('click')
    await vi.waitFor(() => expect(find('[data-testid="subject-form-error"]').exists()).toBe(true))

    expect(find('[data-testid="subject-form-error"]').text()).toBe('Já existe uma disciplina chamada Biologia.')
    expect(find('[data-testid="subject-name-input"]').exists()).toBe(true)
  })

  it('sends the same client-generated id on a second Save after a failure', async () => {
    const create = vi
      .spyOn(store, 'create')
      .mockRejectedValueOnce(new ApiError('content.subject.name_already_taken', { name: 'Biologia' }, 409))
      .mockResolvedValueOnce({ id: 'whatever', name: 'Biologia', active: true })

    render()
    await vi.waitFor(() => expect(find('[data-testid="subjects-list"]').exists()).toBe(true))

    await find('[data-testid="subjects-create"]').trigger('click')
    await find('[data-testid="subject-name-input"] input').setValue('Biologia')
    await find('[data-testid="subject-save"]').trigger('click')
    // Wait for the failure to actually render (not just for the mock to have been
    // called): that is what tells us `saving` flipped back to false and the
    // button is clickable again.
    await vi.waitFor(() => expect(find('[data-testid="subject-form-error"]').exists()).toBe(true))

    await find('[data-testid="subject-save"]').trigger('click')
    await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(2))

    const firstId = create.mock.calls[0]![0].id
    const secondId = create.mock.calls[1]![0].id
    expect(secondId).toBe(firstId)
  })
})
