import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import ApiErrorAlert from '@/shared/ui/ApiErrorAlert.vue'
import { i18n } from '@/shared/i18n'
import { ApiError } from '@/shared/api/error'

const vuetify = createVuetify({ components, directives })
const Stub = { render: () => null }

async function render(error: ApiError) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:any(.*)*', component: Stub }] })
  await router.push('/subjects/s-1/topics')

  const wrapper = mount(ApiErrorAlert, {
    props: { error, testid: 'topics' },
    global: { plugins: [vuetify, i18n, router] },
  })
  await flushPromises()

  return wrapper
}

describe('ApiErrorAlert', () => {
  it('shows the translated message and asks to retry', async () => {
    const wrapper = await render(new ApiError('api.network_unavailable'))

    expect(wrapper.find('[data-testid="topics-error"]').text()).toContain('Sem conexão')
    await wrapper.find('[data-testid="topics-retry"]').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
    expect(wrapper.find('[data-testid="topics-change-password"]').exists()).toBe(false)
  })

  it('offers the password change when the server demands it, coming back here afterwards', async () => {
    const wrapper = await render(new ApiError('identity.password_change_required', {}, 403))

    const button = wrapper.find('[data-testid="topics-change-password"]')
    expect(button.text()).toBe('Trocar senha')
    expect(button.attributes('href')).toBe('/change-password?redirect=/subjects/s-1/topics')
  })
})
