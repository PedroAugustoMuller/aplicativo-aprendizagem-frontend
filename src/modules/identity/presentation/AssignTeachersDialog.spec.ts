import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import AssignTeachersDialog from '@/modules/identity/presentation/AssignTeachersDialog.vue'
import { useClassroomStore } from '@/modules/identity/application/classroomStore'
import { useTeacherStore } from '@/modules/identity/application/teacherStore'
import { i18n } from '@/shared/i18n'
import type { ClassroomSummary } from '@/modules/identity/domain/Classroom'

const vuetify = createVuetify({ components, directives })

let wrapper: VueWrapper | null = null
let classroomStore: ReturnType<typeof useClassroomStore>
let teacherStore: ReturnType<typeof useTeacherStore>

// v-dialog teleports its content to document.body, outside wrapper.element,
// so lookups go through the body rather than the mounted wrapper.
const find = (selector: string) => new DOMWrapper(document.body).find(selector)

const classroom: ClassroomSummary = {
  id: 'c-1',
  name: 'Química 1',
  subjectId: 's-1',
  teacherIds: ['t-1'],
  studentCount: 2,
  active: true,
}

const render = (): VueWrapper => {
  // Mounted CLOSED and then opened, exactly like ClassroomsPage does: the
  // pre-selection logic lives in a watch(open, ...) that only fires on the
  // false -> true transition, not on an initial `open: true` prop.
  wrapper = mount(AssignTeachersDialog, {
    props: { open: false, classroom },
    attachTo: document.body,
    global: { plugins: [vuetify, i18n] },
  })
  return wrapper
}

describe('AssignTeachersDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    classroomStore = useClassroomStore()
    teacherStore = useTeacherStore()
    vi.spyOn(teacherStore, 'load').mockResolvedValue()
    teacherStore.teachers = [
      { id: 't-1', name: 'Bruno', login: 'bruno@escola.br', mustChangePassword: false, active: true },
      { id: 't-2', name: 'Carla', login: 'carla@escola.br', mustChangePassword: false, active: true },
    ]
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('pre-selects exactly the classroom\'s current teachers when it opens', async () => {
    render()
    await wrapper!.setProps({ open: true })
    await vi.waitFor(() => expect(find('[data-testid="assign-teachers-select"]').exists()).toBe(true))

    const select = wrapper!.findComponent({ name: 'VAutocomplete' })
    expect(select.props('modelValue')).toEqual(['t-1'])
  })

  it('labels a deactivated-but-assigned teacher by name, not a raw id', async () => {
    teacherStore.teachers = [
      { id: 't-1', name: 'Bruno', login: 'bruno@escola.br', mustChangePassword: false, active: true },
      { id: 't-2', name: 'Carla', login: 'carla@escola.br', mustChangePassword: false, active: false },
    ]
    // t-2 was deactivated after being assigned - it must still resolve to a
    // labelled item instead of dropping out of `items` entirely.
    render()
    await wrapper!.setProps({ open: true, classroom: { ...classroom, teacherIds: ['t-1', 't-2'] } })
    await vi.waitFor(() => expect(find('[data-testid="assign-teachers-select"]').exists()).toBe(true))

    const select = wrapper!.findComponent({ name: 'VAutocomplete' })
    const items = select.props('items') as { title: string; value: string }[]
    const inactiveItem = items.find((item) => item.value === 't-2')

    expect(inactiveItem?.title).toBe('Carla (inativo)')
  })

  it('saves the full edited set, replacing rather than adding to it', async () => {
    const assignTeachers = vi
      .spyOn(classroomStore, 'assignTeachers')
      .mockResolvedValue({ ...classroom, teacherIds: ['t-2'] })

    render()
    await wrapper!.setProps({ open: true })
    await vi.waitFor(() => expect(find('[data-testid="assign-teachers-select"]').exists()).toBe(true))

    // Drop t-1 and pick t-2: a real teacher losing access, not an addition.
    const select = wrapper!.findComponent({ name: 'VAutocomplete' })
    await select.vm.$emit('update:modelValue', ['t-2'])
    await find('[data-testid="assign-teachers-save"]').trigger('click')

    await vi.waitFor(() => expect(assignTeachers).toHaveBeenCalled())
    expect(assignTeachers).toHaveBeenCalledWith('c-1', ['t-2'])
  })
})
