import { defineComponent, h } from 'vue'
import { config } from '@vue/test-utils'

// Vuetify components need a resize observer that happy-dom does not provide.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

// v-dialog teleports to <body> and animates; unit tests render its content in place.
config.global.stubs = {
  ...config.global.stubs,
  VDialog: defineComponent({
    props: { modelValue: { type: Boolean, default: false } },
    setup(props, { slots }) {
      return () => (props.modelValue ? h('div', { class: 'v-dialog-stub' }, slots.default?.({ isActive: { value: true } })) : null)
    },
  }),
}
