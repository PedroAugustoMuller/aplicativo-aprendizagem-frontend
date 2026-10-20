import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import QuestionSuggestionsPage from '@/modules/content/presentation/QuestionSuggestionsPage.vue'
import { i18n } from '@/shared/i18n'
import { ApiError } from '@/shared/api/error'
import { SourceFileError } from '@/modules/content/domain/QuestionSuggestion'
import { configureOffline } from '@/shared/offline/readThrough'
import { createMemoryStorage } from '@/shared/offline/storage'

const { list, listBySubject, listByTopic, create, suggest, readSourceFile } = vi.hoisted(() => ({
  list: vi.fn(), listBySubject: vi.fn(), listByTopic: vi.fn(), create: vi.fn(), suggest: vi.fn(), readSourceFile: vi.fn(),
}))

vi.mock('@/modules/content/infrastructure/HttpSubjectRepository', () => ({ subjectRepository: { list } }))
vi.mock('@/modules/content/infrastructure/HttpTopicRepository', () => ({ topicRepository: { listBySubject } }))
vi.mock('@/modules/content/infrastructure/HttpQuestionRepository', () => ({ questionRepository: { listByTopic, create } }))
vi.mock('@/modules/content/infrastructure/HttpQuestionSuggestionRepository', () => ({ questionSuggestionRepository: { suggest } }))
vi.mock('@/modules/content/application/sourceFile', () => ({ readSourceFile }))

const vuetify = createVuetify({ components, directives })
const Stub = { render: () => null }
const App = { render: () => h(RouterView) }
const TF = { type: 'true_false', statement: 'O sódio é um metal.', explanation: null, answer: true }
const MC = {
  type: 'multiple_choice', statement: 'Símbolo do sódio?', explanation: 'Natrium.',
  options: [{ id: null, text: 'Na', correct: true }, { id: null, text: 'S', correct: false }],
}
const PAGE = '/subjects/s-1/topics/t-1/questions/suggestions'

async function render() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/subjects/:subjectId/topics/:topicId/questions', component: Stub },
      { path: '/subjects/:subjectId/topics/:topicId/questions/new', component: Stub },
      { path: '/subjects/:subjectId/topics/:topicId/questions/suggestions', component: QuestionSuggestionsPage },
    ],
  })
  await router.push(PAGE)
  const wrapper = mount(App, { global: { plugins: [vuetify, i18n, router] } })
  await flushPromises()

  return { wrapper, router }
}

const generate = async (wrapper: ReturnType<typeof mount>) => {
  await wrapper.find('[data-testid="suggestions-generate"]').trigger('click')
  await flushPromises()
}

describe('QuestionSuggestionsPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    configureOffline({ userId: () => 'u-1', storage: createMemoryStorage() })
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    listBySubject.mockResolvedValue([{ id: 't-1', name: 'Tabela Periódica', description: '', position: 0, active: true, questionCount: 0 }])
    listByTopic.mockResolvedValue([])
    list.mockResolvedValue([{ id: 's-1', name: 'Biologia', active: true, canAuthor: true }])
  })

  it('sends the request and lists the suggestions', async () => {
    suggest.mockResolvedValue([TF, MC])
    const { wrapper } = await render()

    await wrapper.find('[data-testid="suggestions-notes"] textarea:not(.v-textarea__sizer)').setValue('Sem cálculos')
    await generate(wrapper)

    expect(suggest).toHaveBeenCalledWith('t-1', expect.objectContaining({ count: 5, difficulty: 'medium', notes: 'Sem cálculos' }))
    expect(wrapper.findAll('[data-testid^="suggestion-item-"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('Símbolo do sódio?')
  })

  it('accepts one suggestion into the bank and removes its card', async () => {
    suggest.mockResolvedValue([TF])
    create.mockResolvedValue({})
    const { wrapper } = await render()
    await generate(wrapper)

    await wrapper.find('[data-testid^="suggestion-accept-"]').trigger('click')
    await flushPromises()

    expect(create).toHaveBeenCalledWith('t-1', expect.any(String), TF)
    expect(wrapper.findAll('[data-testid^="suggestion-item-"]')).toHaveLength(0)
  })

  it('discards a suggestion', async () => {
    suggest.mockResolvedValue([TF, MC])
    const { wrapper } = await render()
    await generate(wrapper)

    await wrapper.find('[data-testid^="suggestion-discard-"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('[data-testid^="suggestion-item-"]')).toHaveLength(1)
    expect(create).not.toHaveBeenCalled()
  })

  it('edit links to the question form with the suggestion key', async () => {
    suggest.mockResolvedValue([TF])
    const { wrapper } = await render()
    await generate(wrapper)

    const href = wrapper.find('[data-testid^="suggestion-edit-"]').attributes('href')
    expect(href).toMatch(/^\/subjects\/s-1\/topics\/t-1\/questions\/new\?suggestion=.+/)
  })

  it('shows the provider error and keeps what was typed', async () => {
    suggest.mockRejectedValue(new ApiError('content.suggestions.unavailable', {}, 503))
    const { wrapper } = await render()
    await wrapper.find('[data-testid="suggestions-source"] textarea:not(.v-textarea__sizer)').setValue('O sódio reage com a água.')

    await generate(wrapper)

    expect(wrapper.find('[data-testid="suggestions-error"]').text()).toContain('A IA não respondeu agora')
    expect((wrapper.find('[data-testid="suggestions-source"] textarea:not(.v-textarea__sizer)').element as HTMLTextAreaElement).value).toBe('O sódio reage com a água.')
  })

  it('turns a 429 into minutes to wait', async () => {
    suggest.mockRejectedValue(new ApiError('http.too_many_requests', { retry_after: 125 }, 429))
    const { wrapper } = await render()

    await generate(wrapper)

    expect(wrapper.find('[data-testid="suggestions-error"]').text()).toContain('Tente de novo em 3 min')
  })

  it('counts a daily limit in hours, not thousands of minutes', async () => {
    suggest.mockRejectedValue(new ApiError('http.too_many_requests', { retry_after: 80_000 }, 429))
    const { wrapper } = await render()

    await generate(wrapper)

    expect(wrapper.find('[data-testid="suggestions-error"]').text()).toContain('Tente de novo em 23 h')
  })

  it('a 429 while accepting is not called a generation limit', async () => {
    suggest.mockResolvedValue([TF])
    create.mockRejectedValue(new ApiError('http.too_many_requests', { retry_after: 30 }, 429))
    const { wrapper } = await render()
    await generate(wrapper)

    await wrapper.find('[data-testid^="suggestion-accept-"]').trigger('click')
    await flushPromises()

    const text = wrapper.find('[data-testid="suggestions-error"]').text()
    expect(text).toContain('Muitas tentativas seguidas')
    expect(text).not.toContain('Limite de gerações')
  })

  it('blocks sending more than 30 000 characters of source text', async () => {
    const { wrapper } = await render()
    await wrapper.find('[data-testid="suggestions-source"] textarea:not(.v-textarea__sizer)').setValue('a'.repeat(30_001))

    expect(wrapper.find('[data-testid="suggestions-generate"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="suggestions-too-long"]').text()).toContain('O material de base passa de')
  })

  it('blocks sending with no type chosen', async () => {
    const { wrapper } = await render()
    await wrapper.find('[data-testid="suggestions-type-multiple_choice"] input').setValue(false)
    await wrapper.find('[data-testid="suggestions-type-true_false"] input').setValue(false)

    expect(wrapper.find('[data-testid="suggestions-generate"]').attributes('disabled')).toBeDefined()
  })

  it('asks before leaving with pending suggestions, but not when opening one to edit', async () => {
    suggest.mockResolvedValue([TF])
    const { wrapper, router } = await render()
    await generate(wrapper)

    await router.push('/subjects/s-1/topics/t-1/questions')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe(PAGE)
    expect(wrapper.find('[data-testid="suggestions-leave"]').exists()).toBe(true)

    const key = wrapper.find('[data-testid^="suggestion-item-"]').attributes('data-testid')!.replace('suggestion-item-', '')
    await router.push(`/subjects/s-1/topics/t-1/questions/new?suggestion=${key}`)
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/subjects/s-1/topics/t-1/questions/new')
  })

  it('comes back with the suggestions and the form still there', async () => {
    suggest.mockResolvedValue([TF])
    const first = await render()
    await first.wrapper.find('[data-testid="suggestions-notes"] textarea:not(.v-textarea__sizer)').setValue('Sem cálculos')
    await generate(first.wrapper)
    first.wrapper.unmount()

    const second = await render()

    expect(second.wrapper.findAll('[data-testid^="suggestion-item-"]')).toHaveLength(1)
    expect((second.wrapper.find('[data-testid="suggestions-notes"] textarea:not(.v-textarea__sizer)').element as HTMLTextAreaElement).value).toBe('Sem cálculos')
  })

  it('puts the attached file text in the source field and warns when it was cut', async () => {
    readSourceFile.mockResolvedValue({ text: 'Texto do PDF', truncated: true })
    const { wrapper } = await render()

    const input = wrapper.find('[data-testid="suggestions-file"]')
    Object.defineProperty(input.element, 'files', { value: [new File(['x'], 'aula.pdf')] })
    await input.trigger('change')
    await flushPromises()

    expect((wrapper.find('[data-testid="suggestions-source"] textarea:not(.v-textarea__sizer)').element as HTMLTextAreaElement).value).toBe('Texto do PDF')
    expect(wrapper.find('[data-testid="suggestions-truncated"]').exists()).toBe(true)
  })

  it('explains a file it cannot read', async () => {
    readSourceFile.mockRejectedValue(new SourceFileError('no_text'))
    const { wrapper } = await render()

    const input = wrapper.find('[data-testid="suggestions-file"]')
    Object.defineProperty(input.element, 'files', { value: [new File(['x'], 'scan.pdf')] })
    await input.trigger('change')
    await flushPromises()

    expect(wrapper.find('[data-testid="suggestions-file-error"]').text()).toContain('PDF escaneado')
  })

  it('names the request and the material for what they are', async () => {
    const { wrapper } = await render()

    expect(wrapper.find('[data-testid="suggestions-notes"]').text()).toContain('Pedido para a IA')
    expect(wrapper.find('[data-testid="suggestions-notes"]').text()).toContain('3º ano do fundamental')
    expect(wrapper.find('[data-testid="suggestions-source"]').text()).toContain('Material de base')
    expect(wrapper.find('[data-testid="suggestions-source"]').text()).toContain('não como instrução')
  })

  it('shows the subject and the topic the questions will be saved in', async () => {
    const { wrapper } = await render()

    expect(wrapper.find('[data-testid="suggestions-context"]').text()).toBe('Biologia · Tabela Periódica')
  })
})
