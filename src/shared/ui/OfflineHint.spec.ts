import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import OfflineHint from '@/shared/ui/OfflineHint.vue'
import { i18n } from '@/shared/i18n'

const vuetify = createVuetify({ components, directives })

function setOnline(online: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true })
  window.dispatchEvent(new Event(online ? 'online' : 'offline'))
}

describe('OfflineHint', () => {
  afterEach(() => setOnline(true))

  it('says why changes are disabled while offline (a tooltip never shows on a phone)', () => {
    setOnline(false)

    const wrapper = mount(OfflineHint, { global: { plugins: [vuetify, i18n] } })

    expect(wrapper.find('[data-testid="offline-hint"]').text())
      .toBe('Sem conexão: criar, editar e desativar voltam quando a internet voltar.')
  })

  it('appears when the connection drops and goes away when it returns', async () => {
    setOnline(true)
    const wrapper = mount(OfflineHint, { global: { plugins: [vuetify, i18n] } })
    expect(wrapper.find('[data-testid="offline-hint"]').exists()).toBe(false)

    setOnline(false)
    await nextTick()
    expect(wrapper.find('[data-testid="offline-hint"]').exists()).toBe(true)

    setOnline(true)
    await nextTick()
    expect(wrapper.find('[data-testid="offline-hint"]').exists()).toBe(false)
  })
})
