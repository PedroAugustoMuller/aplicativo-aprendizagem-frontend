import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import LevelUpDialog from '@/modules/quiz/presentation/LevelUpDialog.vue'
import { useProgressStore } from '@/modules/quiz/application/progressStore'
import { i18n } from '@/shared/i18n'

vi.mock('@/modules/quiz/infrastructure/HttpProgressRepository', () => ({ progressRepository: {} }))

const vuetify = createVuetify({ components })

function reducedMotion(reduce: boolean): void {
  Object.defineProperty(globalThis, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion: reduce'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
    }),
  })
}

async function render() {
  const wrapper = mount(LevelUpDialog, { global: { plugins: [vuetify, i18n] } })
  await flushPromises()

  return wrapper
}

describe('LevelUpDialog', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('stays closed without a celebration', async () => {
    reducedMotion(false)
    const wrapper = await render()

    expect(wrapper.find('[data-testid="level-up"]').exists()).toBe(false)
  })

  it('announces the new tier with motion and closes', async () => {
    reducedMotion(false)
    const store = useProgressStore()
    store.celebration = 'gold'
    const wrapper = await render()

    const dialog = wrapper.get('[data-testid="level-up"]')
    expect(dialog.text()).toContain('Você subiu para Ouro!')
    expect(dialog.get('[data-testid="tier-badge"]').attributes('data-tier')).toBe('gold')
    expect(dialog.classes()).toContain('level-up--animated')

    await wrapper.get('[data-testid="level-up-close"]').trigger('click')
    expect(store.celebration).toBeNull()
    expect(wrapper.find('[data-testid="level-up"]').exists()).toBe(false)
  })

  it('keeps still under reduced motion', async () => {
    reducedMotion(true)
    useProgressStore().celebration = 'gold'
    const wrapper = await render()

    expect(wrapper.get('[data-testid="level-up"]').classes()).not.toContain('level-up--animated')
  })
})
