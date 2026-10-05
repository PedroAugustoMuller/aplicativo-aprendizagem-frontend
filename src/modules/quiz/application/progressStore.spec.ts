import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useProgressStore } from '@/modules/quiz/application/progressStore'
import { configureOffline } from '@/shared/offline/readThrough'
import { createMemoryStorage } from '@/shared/offline/storage'
import { configureViewerId } from '@/shared/auth/viewer'
import { ApiError } from '@/shared/api/error'
import { OWN, type TopicHistory } from '@/modules/quiz/domain/Progress'

const repo = vi.hoisted(() => ({
  subjectProgress: vi.fn(), topicHistory: vi.fn(), wrongQuestions: vi.fn(), attempt: vi.fn(), classroomProgress: vi.fn(), questionSummary: vi.fn(),
}))
vi.mock('@/modules/quiz/infrastructure/HttpProgressRepository', () => ({ progressRepository: repo }))

const vault = vi.hoisted(() => ({ celebrated: vi.fn(), markCelebrated: vi.fn() }))
vi.mock('@/modules/quiz/infrastructure/persistence/quizVault', () => ({ quizVault: vault }))

const offline = () => Promise.reject(new ApiError('api.network_unavailable'))
const STAFF = { kind: 'student', classroomId: 'c-1', studentId: 'u-9' } as const

const LEVELED: TopicHistory = {
  points: 60, tier: 'bronze', nextTier: { tier: 'silver', points: 150 },
  attempts: [{ id: 'a-1', startedAt: 's', completedAt: 'c', total: 10, answered: 10, correct: 6, pointsBefore: 0, pointsAfter: 60, pointsChange: 60, tierBefore: 'iron', tierAfter: 'bronze' }],
}

describe('progressStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    configureOffline({ userId: () => 'u-1', storage: createMemoryStorage() })
    configureViewerId(() => 'u-1')
    Object.values(repo).forEach((fn) => fn.mockReset())
    vault.celebrated.mockReset().mockResolvedValue(false)
    vault.markCelebrated.mockReset().mockResolvedValue(undefined)
  })

  it('keys subject tiers by topic and keeps quiet when they cannot load', async () => {
    const store = useProgressStore()
    repo.subjectProgress.mockResolvedValueOnce([{ topicId: 't-1', points: 60, tier: 'bronze', nextTier: null }])

    await store.loadSubject('s-1')
    expect(store.subjectTiers['t-1']?.tier).toBe('bronze')

    repo.subjectProgress.mockRejectedValueOnce(new ApiError('system.unexpected_error'))
    await store.loadSubject('s-2')
    expect(store.subjectTiers).toEqual({})
  })

  it('loads history and the study list together and falls back to the saved copy offline', async () => {
    const store = useProgressStore()
    repo.topicHistory.mockResolvedValueOnce(LEVELED)
    repo.wrongQuestions.mockResolvedValueOnce([])
    await store.loadTopic(OWN, 't-1')
    expect(store.savedAt).toBeNull()

    repo.topicHistory.mockImplementationOnce(offline)
    repo.wrongQuestions.mockImplementationOnce(offline)
    await store.loadTopic(OWN, 't-1')

    expect(store.history?.points).toBe(60)
    expect(store.savedAt).toBeInstanceOf(Date)
    expect(store.error).toBeNull()
  })

  it('keeps staff copies apart from the student own copies', async () => {
    const store = useProgressStore()
    repo.topicHistory.mockResolvedValueOnce(LEVELED)
    repo.wrongQuestions.mockResolvedValueOnce([])
    await store.loadTopic(OWN, 't-1')

    repo.topicHistory.mockImplementationOnce(offline)
    repo.wrongQuestions.mockImplementationOnce(offline)
    await store.loadTopic(STAFF, 't-1')

    expect(store.history).toBeNull()
    expect(store.error?.code).toBe('api.network_unavailable')
  })

  it('celebrates a level-up once, and only when asked to', async () => {
    const store = useProgressStore()
    repo.topicHistory.mockResolvedValue(LEVELED)
    repo.wrongQuestions.mockResolvedValue([])

    await store.loadTopic(OWN, 't-1')
    expect(store.celebration).toBeNull()

    await store.loadTopic(OWN, 't-1', { celebrate: true })
    expect(store.celebration).toBe('bronze')
    expect(vault.markCelebrated).toHaveBeenCalledWith('u-1', 'a-1')

    store.dismissCelebration()
    vault.celebrated.mockResolvedValue(true)
    await store.loadTopic(OWN, 't-1', { celebrate: true })
    expect(store.celebration).toBeNull()
  })

  it('still celebrates when the mark cannot be read or written', async () => {
    const store = useProgressStore()
    repo.topicHistory.mockResolvedValue(LEVELED)
    repo.wrongQuestions.mockResolvedValue([])
    vault.celebrated.mockRejectedValue(new Error('quota'))
    vault.markCelebrated.mockRejectedValue(new Error('quota'))

    await store.loadTopic(OWN, 't-1', { celebrate: true })

    expect(store.celebration).toBe('bronze')
  })

  it('never celebrates from a saved offline copy, a tier drop or a staff view', async () => {
    const store = useProgressStore()
    repo.topicHistory.mockResolvedValueOnce(LEVELED)
    repo.wrongQuestions.mockResolvedValue([])
    await store.loadTopic(OWN, 't-1')
    repo.topicHistory.mockImplementationOnce(offline)
    await store.loadTopic(OWN, 't-1', { celebrate: true })
    expect(store.celebration).toBeNull()

    repo.topicHistory.mockResolvedValueOnce({ ...LEVELED, attempts: [{ ...LEVELED.attempts[0]!, tierBefore: 'silver', tierAfter: 'bronze' }] })
    await store.loadTopic(OWN, 't-1', { celebrate: true })
    expect(store.celebration).toBeNull()

    repo.topicHistory.mockResolvedValueOnce(LEVELED)
    await store.loadTopic(STAFF, 't-1', { celebrate: true })
    expect(store.celebration).toBeNull()
  })

  it('lets only the latest topic load write', async () => {
    const store = useProgressStore()
    let release: (h: TopicHistory) => void = () => undefined
    repo.topicHistory.mockReturnValueOnce(new Promise<TopicHistory>((resolve) => { release = resolve }))
    repo.wrongQuestions.mockResolvedValue([])
    const slow = store.loadTopic(OWN, 't-old')

    repo.topicHistory.mockResolvedValueOnce({ ...LEVELED, points: 7 })
    await store.loadTopic(OWN, 't-new')
    release(LEVELED)
    await slow

    expect(store.history?.points).toBe(7)
  })

  it('loads a reviewed attempt and the classroom grid, and forgets everything on reset', async () => {
    const store = useProgressStore()
    repo.attempt.mockResolvedValueOnce({ id: 'a-1', topicId: 't-1', startedAt: 's', completedAt: 'c', score: { total: 0, answered: 0, correct: 0 }, questions: [] })
    repo.classroomProgress.mockResolvedValueOnce([{ id: 'u-1', name: 'Carla', username: 'carla.dias', topics: [] }])

    await store.loadAttempt(OWN, 'a-1')
    await store.loadClassroom('c-1')

    expect(store.reviewed?.id).toBe('a-1')
    expect(repo.attempt).toHaveBeenCalledWith(OWN, 'a-1')
    expect(store.classroom.map((s) => s.name)).toEqual(['Carla'])

    store.reset()
    expect([store.reviewed, store.classroom, store.history]).toEqual([null, [], null])
  })

  it('reports a failed review or grid load', async () => {
    const store = useProgressStore()
    repo.attempt.mockRejectedValueOnce(new ApiError('quiz.attempt_not_found'))
    repo.classroomProgress.mockRejectedValueOnce(new ApiError('auth.forbidden'))

    await store.loadAttempt(STAFF, 'a-1')
    await store.loadClassroom('c-1')

    expect(store.reviewError?.code).toBe('quiz.attempt_not_found')
    expect(store.classroomError?.code).toBe('auth.forbidden')
  })

  it('forgets another subject tiers as soon as a new subject starts loading, and says which subject they are for', async () => {
    const store = useProgressStore()
    repo.subjectProgress.mockResolvedValueOnce([{ topicId: 't-1', points: 60, tier: 'bronze', nextTier: null }])
    await store.loadSubject('s-1')
    expect(store.subjectTiersFor).toBe('s-1')

    let release: (v: unknown[]) => void = () => undefined
    repo.subjectProgress.mockReturnValueOnce(new Promise((resolve) => { release = resolve }))
    const pending = store.loadSubject('s-2')
    expect(store.subjectTiersFor).toBeNull()
    expect(store.subjectTiers).toEqual({})
    release([])
    await pending
    expect(store.subjectTiersFor).toBe('s-2')

    repo.subjectProgress.mockRejectedValueOnce(new ApiError('system.unexpected_error'))
    await store.loadSubject('s-2')
    expect(store.subjectTiersFor).toBeNull()
  })

  it('never shows another topic, student, attempt or classroom while the new one loads', async () => {
    const store = useProgressStore()
    repo.topicHistory.mockResolvedValueOnce(LEVELED)
    repo.wrongQuestions.mockResolvedValue([{ questionId: 'q1' }])
    repo.attempt.mockResolvedValueOnce({ id: 'a-1' })
    repo.classroomProgress.mockResolvedValueOnce([{ id: 'u-1', name: 'Carla', username: 'c', topics: [] }])
    await store.loadTopic(OWN, 't-1')
    await store.loadAttempt(OWN, 'a-1')
    await store.loadClassroom('c-1')

    const never = new Promise<never>(() => undefined)
    repo.topicHistory.mockReturnValue(never)
    repo.attempt.mockReturnValue(never)
    repo.classroomProgress.mockReturnValue(never)
    void store.loadTopic(STAFF, 't-1')
    void store.loadAttempt(OWN, 'a-2')
    void store.loadClassroom('c-2')

    expect([store.history, store.wrong, store.reviewed, store.classroom]).toEqual([null, [], null, []])
  })

  it('keeps the data on screen while the same topic reloads', async () => {
    const store = useProgressStore()
    repo.topicHistory.mockResolvedValueOnce(LEVELED)
    repo.wrongQuestions.mockResolvedValue([])
    await store.loadTopic(OWN, 't-1')

    repo.topicHistory.mockReturnValue(new Promise<never>(() => undefined))
    void store.loadTopic(OWN, 't-1')

    expect(store.history?.points).toBe(60)
  })

  describe('question summary', () => {
    const SUMMARY = { students: 2, questions: [] }
    const CLASSROOM = { kind: 'classroom', classroomId: 'c-1' } as const
    const SUBJECT = { kind: 'subject' } as const

    it('loads one classroom or the whole subject, and falls back to the saved copy offline', async () => {
      const store = useProgressStore()
      repo.questionSummary.mockResolvedValueOnce(SUMMARY).mockImplementationOnce(offline)

      await store.loadSummary(CLASSROOM, 't-1')
      expect(store.summary).toEqual(SUMMARY)
      expect(store.summarySavedAt).toBeNull()
      expect(repo.questionSummary).toHaveBeenCalledWith(CLASSROOM, 't-1')

      await store.loadSummary(CLASSROOM, 't-1')
      expect(store.summary).toEqual(SUMMARY)
      expect(store.summarySavedAt).toBeInstanceOf(Date)
    })

    it('keeps the classroom and the subject copies apart', async () => {
      const store = useProgressStore()
      repo.questionSummary.mockResolvedValueOnce(SUMMARY).mockImplementationOnce(offline)

      await store.loadSummary(CLASSROOM, 't-1')
      await store.loadSummary(SUBJECT, 't-1')

      expect(store.summary).toBeNull()
      expect(store.summaryError?.code).toBe('api.network_unavailable')
    })

    it('lets only the latest load write and clears the screen when the scope changes', async () => {
      const store = useProgressStore()
      repo.questionSummary.mockResolvedValueOnce(SUMMARY)
      await store.loadSummary(CLASSROOM, 't-1')

      let release: (v: unknown) => void = () => undefined
      repo.questionSummary.mockReturnValueOnce(new Promise((resolve) => { release = resolve }))
      const slow = store.loadSummary(SUBJECT, 't-1')
      expect(store.summary).toBeNull()
      expect(store.summaryLoading).toBe(true)

      repo.questionSummary.mockResolvedValueOnce({ students: 5, questions: [] })
      await store.loadSummary(CLASSROOM, 't-2')
      release({ students: 99, questions: [] })
      await slow

      expect(store.summary?.students).toBe(5)
      expect(store.summaryLoading).toBe(false)
    })

    it('reports a failure and forgets the summary on reset', async () => {
      const store = useProgressStore()
      repo.questionSummary.mockRejectedValueOnce(new ApiError('auth.forbidden')).mockResolvedValueOnce(SUMMARY)

      await store.loadSummary(SUBJECT, 't-1')
      expect(store.summaryError?.code).toBe('auth.forbidden')

      await store.loadSummary(CLASSROOM, 't-1')
      store.reset()
      expect([store.summary, store.summarySavedAt, store.summaryError, store.summaryLoading]).toEqual([null, null, null, false])
    })
  })
})
