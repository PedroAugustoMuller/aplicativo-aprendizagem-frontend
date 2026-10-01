import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import OfflineBanner from '@/shared/ui/OfflineBanner.vue'
import { i18n } from '@/shared/i18n'

const vuetify = createVuetify({ components, directives })

describe('OfflineBanner', () => {
  it('says the data is saved and from when', () => {
    const savedAt = new Date(2026, 8, 30, 12, 40)
    const wrapper = mount(OfflineBanner, { props: { savedAt }, global: { plugins: [vuetify, i18n] } })

    expect(wrapper.find('[data-testid="offline-banner"]').text())
      .toBe('Sem conexão — mostrando dados salvos às 12:40.')
  })

  it('renders nothing for live data', () => {
    const wrapper = mount(OfflineBanner, { props: { savedAt: null }, global: { plugins: [vuetify, i18n] } })

    expect(wrapper.find('[data-testid="offline-banner"]').exists()).toBe(false)
  })
})
