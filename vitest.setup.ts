// Vuetify components need a resize observer that happy-dom does not provide.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

// Vuetify's VOverlay (v-dialog, v-menu, ...) location strategy reads
// window.visualViewport, which happy-dom does not implement. Without this,
// mounting any component that opens an overlay throws "visualViewport is
// not defined".
if (typeof window !== 'undefined' && window.visualViewport === undefined) {
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: {
      width: window.innerWidth,
      height: window.innerHeight,
      addEventListener: (): void => {},
      removeEventListener: (): void => {},
    },
  })
}
