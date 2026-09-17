import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { mdiWeatherNight } from '@mdi/js'
import { VAlert, VIcon } from 'vuetify/components'
import { vuetify } from '@/plugins/vuetify'

// The app ships no icon webfont: every icon must render as an inline <svg>
// path, or it is an empty box on the student's screen.
const render = (node: () => ReturnType<typeof h>) =>
  mount(defineComponent({ render: node }), { global: { plugins: [vuetify] } })

describe('vuetify icons', () => {
  it('renders an @mdi/js path as an inline svg', () => {
    const wrapper = render(() => h(VIcon, { icon: mdiWeatherNight }))

    expect(wrapper.find('svg path').attributes('d')).toBe(mdiWeatherNight)
  })

  it("renders Vuetify's own alias icons (such as an alert's) as inline svg", () => {
    const wrapper = render(() => h(VAlert, { type: 'error', text: 'x' }))

    const path = wrapper.find('.v-alert__prepend svg path')
    expect(path.exists()).toBe(true)
    expect(path.attributes('d')).not.toBe('')
    expect(wrapper.find('.v-alert__prepend i.mdi').exists()).toBe(false)
  })
})
