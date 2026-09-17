// Vuetify components need a resize observer that happy-dom does not provide.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
