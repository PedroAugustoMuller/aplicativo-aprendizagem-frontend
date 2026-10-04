import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import TierBadge from '@/modules/quiz/presentation/TierBadge.vue'
import { i18n } from '@/shared/i18n'

const vuetify = createVuetify({ components })

describe('TierBadge', () => {
  it('shows the tier name and points', () => {
    const wrapper = mount(TierBadge, { props: { tier: 'silver', points: 180, size: 'small' }, global: { plugins: [vuetify, i18n] } })

    expect(wrapper.get('[data-testid="tier-badge"]').text()).toBe('Prata · 180 pts')
    expect(wrapper.get('[data-testid="tier-badge"]').attributes('data-tier')).toBe('silver')
  })

  it('shows the large version with the name above the points', () => {
    const wrapper = mount(TierBadge, { props: { tier: 'diamond', points: 820, size: 'large' }, global: { plugins: [vuetify, i18n] } })

    expect(wrapper.get('[data-testid="tier-badge"]').text()).toContain('Diamante')
    expect(wrapper.get('[data-testid="tier-badge"]').text()).toContain('820 pts')
    expect(wrapper.get('[data-testid="tier-badge"]').attributes('data-tier')).toBe('diamond')
  })
})
