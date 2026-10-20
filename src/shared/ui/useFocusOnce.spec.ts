import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { useFocusOnce } from '@/shared/ui/useFocusOnce'

const frames = (n: number) =>
  new Promise<void>((resolve) => {
    const step = (left: number) => (left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1)))
    step(n)
  })

// Two fields; the first is the one to focus. `shown` mounts it later, like a dialog opening.
const Form = defineComponent({
  props: { shown: { type: Boolean, default: true } },
  setup(props) {
    const first = ref<HTMLElement | null>(null)
    useFocusOnce(first)

    return () =>
      h('form', [
        props.shown ? h('div', { ref: first }, [h('input', { id: 'first' })]) : null,
        h('input', { id: 'second' }),
      ])
  },
})

let wrapper: VueWrapper | null = null

const render = (shown = true) => {
  wrapper = mount(Form, { props: { shown }, attachTo: document.body })

  return wrapper
}
const input = (id: string) => document.getElementById(id)

describe('useFocusOnce', () => {
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('focuses the field inside the target once it is mounted', async () => {
    render()
    await nextTick()

    expect(document.activeElement).toBe(input('first'))
  })

  it('never pulls focus back after the user moved to another field', async () => {
    render()
    await nextTick()

    input('second')?.focus()
    await frames(5)

    expect(document.activeElement).toBe(input('second'))
  })

  it('keeps trying while the field cannot take focus yet (a dialog still entering)', async () => {
    render(false)
    await nextTick()
    const real = HTMLElement.prototype.focus
    let refused = 2
    HTMLElement.prototype.focus = function (this: HTMLElement, options?: FocusOptions) {
      if (this.id === 'first' && refused > 0) {
        refused -= 1

        return
      }
      real.call(this, options)
    }

    try {
      await wrapper?.setProps({ shown: true })
      await frames(5)
    } finally {
      HTMLElement.prototype.focus = real
    }

    expect(document.activeElement).toBe(input('first'))
  })

  it('gives up if the user focuses another field while it is still trying', async () => {
    render(false)
    await nextTick()
    const real = HTMLElement.prototype.focus
    HTMLElement.prototype.focus = function (this: HTMLElement, options?: FocusOptions) {
      if (this.id !== 'first') {
        real.call(this, options)
      }
    }

    try {
      await wrapper?.setProps({ shown: true })
      input('second')?.focus()
      HTMLElement.prototype.focus = real
      await frames(5)
    } finally {
      HTMLElement.prototype.focus = real
    }

    expect(document.activeElement).toBe(input('second'))
  })

  it('focuses again each time the field is mounted again (a dialog reopened)', async () => {
    render()
    await nextTick()
    // Closing a dialog hands focus back to the page (its button), not to a field.
    input('first')?.blur()

    await wrapper?.setProps({ shown: false })
    await wrapper?.setProps({ shown: true })
    await nextTick()

    expect(document.activeElement).toBe(input('first'))
  })
})
