import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import AppLayout from '@/shared/ui/AppLayout.vue'
import { useSessionStore } from '@/modules/identity/application/sessionStore'
import { useSubjectStore } from '@/modules/content/application/subjectStore'
import { useTopicStore } from '@/modules/content/application/topicStore'
import { useQuestionStore } from '@/modules/content/application/questionStore'
import { i18n } from '@/shared/i18n'
import { configureOffline, readThrough } from '@/shared/offline/readThrough'
import { createMemoryStorage } from '@/shared/offline/storage'
import { useQuizStore } from '@/modules/quiz/application/quizStore'
import { configureViewerId } from '@/shared/auth/viewer'
import { ApiError } from '@/shared/api/error'

// shared/ui may reach a module only through application/ and presentation/, so
// the repository is mocked by path rather than imported.
vi.mock('@/modules/identity/infrastructure/HttpAuthRepository', () => ({
  authRepository: { login: vi.fn(), logout: vi.fn(), currentUser: vi.fn(), changePassword: vi.fn() },
}))
vi.mock('@/modules/content/infrastructure/HttpSubjectRepository', () => ({ subjectRepository: { list: vi.fn() } }))
vi.mock('@/modules/identity/infrastructure/HttpTeacherRepository', () => ({ teacherRepository: { list: vi.fn() } }))
vi.mock('@/modules/identity/infrastructure/HttpClassroomRepository', () => ({ classroomRepository: { list: vi.fn() } }))
vi.mock('@/modules/identity/infrastructure/HttpStudentRepository', () => ({ studentRepository: { listByClassroom: vi.fn(), search: vi.fn(), enrol: vi.fn() } }))
vi.mock('@/modules/content/infrastructure/HttpTopicRepository', () => ({ topicRepository: { listBySubject: vi.fn() } }))
const quizApi = vi.hoisted(() => ({ start: vi.fn(), get: vi.fn(), answer: vi.fn() }))
vi.mock('@/modules/quiz/infrastructure/HttpQuizRepository', () => ({ quizRepository: quizApi }))

const vuetify = createVuetify({ components, directives })
const Stub = defineComponent({ render: () => null })

async function render() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:any(.*)*', component: Stub }] })
  await router.push('/subjects')

  const wrapper = mount(AppLayout, { global: { plugins: [vuetify, i18n, router] } })
  await flushPromises()

  return wrapper
}

const user = (mustChangePassword: boolean, role: 'admin' | 'teacher' | 'student' = 'admin') => ({
  userId: 'u-1', name: 'Ana', login: 'ana@escola.br', role, mustChangePassword,
}) as const

describe('AppLayout', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    const session = useSessionStore()
    configureViewerId(() => session.knownUser?.userId ?? null)
    session.$patch({ token: 'tok', user: user(false, 'student') })
    await useQuizStore().discardDeviceData()
    session.$patch({ token: null, user: null })
  })

  const offline = () => Promise.reject(new ApiError('api.network_unavailable'))

  /** One answer saved on the device and not sent: the quiz store's own offline path. */
  async function queueOneAnswer(): Promise<void> {
    quizApi.start.mockResolvedValue({
      id: 'a-1', topicId: 't-1', startedAt: 's', completedAt: null, score: { total: 2, answered: 0, correct: 0 },
      questions: ['q1', 'q2'].map((id, position) => ({
        id, position, type: 'true_false', statement: id, options: [{ id: `${id}-v`, text: 'Verdadeiro' }, { id: `${id}-f`, text: 'Falso' }], result: null,
      })),
    })
    quizApi.get.mockImplementation(offline)
    quizApi.answer.mockImplementation(offline)
    const quiz = useQuizStore()
    await quiz.prepare('t-1', { topicName: 'T', subjectId: 's-1' })
    await quiz.open('a-1')
    await quiz.answer('q1', 'q1-v')
  }

  async function unsentCount(): Promise<number> {
    const quiz = useQuizStore()
    await quiz.refreshPending()

    return quiz.pendingCount
  }

  it('shows how many answers wait to be sent', async () => {
    useSessionStore().$patch({ token: 'tok', user: user(false, 'student') })
    await queueOneAnswer()

    const wrapper = await render()

    expect(wrapper.find('[data-testid="quiz-pending-chip"]').text()).toBe('1 resposta aguardando envio')
  })

  it('sends queued answers when the connection comes back', async () => {
    useSessionStore().$patch({ token: 'tok', user: user(false, 'student') })
    await queueOneAnswer()
    await render()
    quizApi.answer.mockResolvedValue({
      result: { questionId: 'q1', optionId: 'q1-v', correct: true, correctOptionId: 'q1-v', explanation: null },
      score: { total: 2, answered: 1, correct: 1 },
      completed: false,
    })

    globalThis.dispatchEvent(new Event('online'))
    await flushPromises()

    expect(await unsentCount()).toBe(0)
  })

  it('asks before signing out with unsent answers, and can stay', async () => {
    useSessionStore().$patch({ token: 'tok', user: user(false, 'student') })
    await queueOneAnswer()
    const wrapper = await render()

    await wrapper.find('[data-testid="sign-out"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="sign-out-pending"]').text()).toContain('Há 1 resposta que ainda não foi enviada.')
    await wrapper.find('[data-testid="sign-out-pending-stay"]').trigger('click')
    await flushPromises()
    expect(useSessionStore().hasSession).toBe(true)
    expect(await unsentCount()).toBe(1)
  })

  it('drops unsent answers only when the user insists on signing out', async () => {
    useSessionStore().$patch({ token: 'tok', user: user(false, 'student') })
    await queueOneAnswer()
    const wrapper = await render()

    await wrapper.find('[data-testid="sign-out"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="sign-out-pending-confirm"]').trigger('click')
    await flushPromises()

    expect(useSessionStore().hasSession).toBe(false)
    useSessionStore().$patch({ token: 'tok', user: user(false, 'student') })
    expect(await unsentCount()).toBe(0)
  })

  it('keeps unsent answers when the session merely expires', async () => {
    useSessionStore().$patch({ token: 'tok', user: user(false, 'student') })
    await queueOneAnswer()
    await render()

    useSessionStore().clear()
    await flushPromises()

    expect(useQuizStore().pendingCount).toBe(0)
    useSessionStore().$patch({ token: 'tok', user: user(false, 'student') })
    expect(await unsentCount()).toBe(1)
  })

  it('shows the navigation to a signed-in user', async () => {
    useSessionStore().$patch({ token: 'tok', user: user(false) })

    const wrapper = await render()

    // happy-dom's default 1024px viewport is under Vuetify's mobile breakpoint
    // (lg), so which nav useDisplay() picks is not the point here - that one does.
    const nav = wrapper.find('.v-navigation-drawer').exists() || wrapper.find('.v-bottom-navigation').exists()
    expect(nav).toBe(true)
    expect(wrapper.find('[data-testid="sign-out"]').exists()).toBe(true)
  })

  it('hides the navigation, but not sign-out, while a password change is pending', async () => {
    useSessionStore().$patch({ token: 'tok', user: user(true) })

    const wrapper = await render()

    expect(wrapper.find('.v-navigation-drawer').exists()).toBe(false)
    expect(wrapper.find('.v-bottom-navigation').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sign-out"]').exists()).toBe(true)
  })

  it('forgets the previous user\'s content when the session ends', async () => {
    useSessionStore().$patch({ token: 'tok', user: user(false) })
    useSubjectStore().$patch({ subjects: [{ id: 's-1', name: 'Química', active: true, canAuthor: false }] })
    useTopicStore().$patch({ subjectId: 's-1', topics: [{ id: 't-1', name: 'Átomos', description: 'x', position: 1, active: true, questionCount: null }] })
    useQuestionStore().$patch({ topicId: 't-1' })
    await render()

    useSessionStore().clear()
    await nextTick()

    expect(useSubjectStore().subjects).toEqual([])
    expect(useTopicStore().topics).toEqual([])
    expect(useTopicStore().subjectId).toBeNull()
    expect(useQuestionStore().topicId).toBeNull()
  })

  it('wipes the previous user\'s saved lists from this phone when the session ends', async () => {
    const storage = createMemoryStorage()
    const session = useSessionStore()
    configureOffline({ userId: () => session.knownUser?.userId ?? null, storage })
    session.$patch({ token: 'tok', user: user(false) })
    await readThrough('identity:teachers', async () => ['Bruno'])
    await render()

    session.clear()
    await flushPromises()

    expect(await storage.keys()).toEqual([])
  })

  it.each([
    ['admin', ['/subjects', '/classrooms', '/teachers']],
    ['teacher', ['/subjects', '/classrooms']],
    ['student', ['/subjects']],
  ] as const)('shows a %s only their areas', async (role, paths) => {
    useSessionStore().$patch({ token: 'tok', user: user(false, role) })

    const wrapper = await render()
    const hrefs = wrapper.findAll('.v-navigation-drawer a, .v-bottom-navigation a').map((link) => link.attributes('href'))

    expect([...new Set(hrefs)]).toEqual(paths)
  })
})
