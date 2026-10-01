import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import { i18n } from '@/shared/i18n'

const vuetify = createVuetify({ components, directives })

const render = () =>
  mount(ConfirmDialog, {
    props: { modelValue: true, title: 'Desativar?', message: 'Tem certeza?', confirmLabel: 'Desativar', testid: 'x' },
    global: { plugins: [vuetify, i18n] },
  })

describe('ConfirmDialog', () => {
  it('asks and confirms', async () => {
    const wrapper = render()

    expect(wrapper.find('[data-testid="x"]').text()).toContain('Tem certeza?')
    await wrapper.find('[data-testid="x-confirm"]').trigger('click')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('closes on cancel without confirming', async () => {
    const wrapper = render()

    await wrapper.find('[data-testid="x-cancel"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })
})
