import { defineComponent, h } from 'vue'
import { config } from '@vue/test-utils'

// Vuetify components need a resize observer that happy-dom does not provide.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

// v-dialog teleports to <body> and animates; unit tests render its content in place.
// Test stubs, not app components: several in one file is the point here.
/* eslint-disable vue/one-component-per-file */
config.global.stubs = {
  ...config.global.stubs,
  VDialog: defineComponent({
    props: { modelValue: { type: Boolean, default: false } },
    setup(props, { slots }) {
      return () => (props.modelValue ? h('div', { class: 'v-dialog-stub' }, slots.default?.({ isActive: { value: true } })) : null)
    },
  }),
  // v-menu positions itself against window.visualViewport, which happy-dom lacks: render the
  // activator and the (always open) content in place instead.
  VMenu: defineComponent({
    setup(_, { slots }) {
      return () => h('div', { class: 'v-menu-stub' }, [slots.activator?.({ props: {}, isActive: false }), slots.default?.({ isActive: { value: true } })])
    },
  }),
}
