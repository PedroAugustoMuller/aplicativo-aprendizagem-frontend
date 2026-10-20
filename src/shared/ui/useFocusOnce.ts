import { onBeforeUnmount, watch, type ComponentPublicInstance, type Ref } from 'vue'

type Target = HTMLElement | ComponentPublicInstance | null

const FIELD = 'input, textarea, select, [contenteditable="true"]'
// A dialog's enter transition keeps its fields unfocusable for a few frames.
const MAX_FRAMES = 60

function fieldOf(target: Target): HTMLElement | null {
  const el: unknown = target instanceof HTMLElement ? target : target?.$el

  if (!(el instanceof HTMLElement)) {
    return null
  }

  return el.matches(FIELD) ? el : el.querySelector<HTMLElement>(FIELD)
}

/**
 * Focuses the first field of a form once, each time it is mounted. Use it
 * instead of Vuetify's `autofocus`, which focuses twice (the native attribute,
 * then again ~50 ms later from an IntersectionObserver): on a slow phone that
 * late second focus pulled a user who had already moved to the next field back,
 * and what they typed landed in the wrong field. This stops as soon as the field
 * has focus, or as soon as any other field does.
 */
export function useFocusOnce(target: Ref<Target>): void {
  let frame = 0

  function attempt(remaining: number): void {
    const field = fieldOf(target.value)
    const active = document.activeElement

    if (field === null || active === field) {
      return
    }

    if (active instanceof HTMLElement && active.matches(FIELD)) {
      return
    }

    field.focus()

    if (document.activeElement !== field && remaining > 0) {
      frame = requestAnimationFrame(() => attempt(remaining - 1))
    }
  }

  watch(
    target,
    (value) => {
      cancelAnimationFrame(frame)

      if (value !== null) {
        attempt(MAX_FRAMES)
      }
    },
    { immediate: true, flush: 'post' },
  )

  onBeforeUnmount(() => cancelAnimationFrame(frame))
}
