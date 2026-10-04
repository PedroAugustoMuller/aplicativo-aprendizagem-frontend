import { beforeEach, describe, expect, it, vi } from 'vitest'
import { progressRepository } from '@/modules/quiz/infrastructure/HttpProgressRepository'
import { quizRequests } from '@/modules/quiz/infrastructure/client/requests'
import { EMPTY_HISTORY, OWN, TIER_THRESHOLDS, levelUpOf, type AttemptSummary, type TopicHistory } from '@/modules/quiz/domain/Progress'
import type { TopicHistoryResponse } from '@/modules/quiz/infrastructure/interfaces/ProgressResponse'

vi.mock('@/modules/quiz/infrastructure/client/requests', () => ({
  quizRequests: {
    start: vi.fn(), get: vi.fn(), answer: vi.fn(),
    subjectProgress: vi.fn(), topicHistory: vi.fn(), wrongQuestions: vi.fn(), classroomProgress: vi.fn(),
    studentTopicHistory: vi.fn(), studentWrongQuestions: vi.fn(), studentAttempt: vi.fn(),
  },
}))

const STAFF = { kind: 'student', classroomId: 'c-1', studentId: 'u-9' } as const

const HISTORY: TopicHistoryResponse = {
  points: 100, tier: 'bronze', next_tier: { tier: 'silver', points: 150 },
  attempts: [{
    id: 'a-2', started_at: '2026-10-02T10:00:00+00:00', completed_at: '2026-10-02T10:10:00+00:00',
    total: 10, answered: 10, correct: 7, points_before: 60, points_after: 100, points_change: 40,
    tier_before: 'bronze', tier_after: 'bronze',
  }],
}

const ATTEMPT = { id: 'a-1', topic_id: 't-1', started_at: 's', completed_at: 'c', score: { total: 0, answered: 0, correct: 0 }, questions: [] }

describe('progressRepository', () => {
  beforeEach(() => vi.resetAllMocks())

  it('maps subject progress, and an unknown tier code to iron', async () => {
    vi.mocked(quizRequests.subjectProgress).mockResolvedValue([
      { topic_id: 't-1', points: 60, tier: 'bronze', next_tier: { tier: 'silver', points: 150 } },
      { topic_id: 't-2', points: 900, tier: 'mythic', next_tier: null },
    ])

    expect(await progressRepository.subjectProgress('s-1')).toEqual([
      { topicId: 't-1', points: 60, tier: 'bronze', nextTier: { tier: 'silver', points: 150 } },
      { topicId: 't-2', points: 900, tier: 'iron', nextTier: null },
    ])
    expect(quizRequests.subjectProgress).toHaveBeenCalledWith('s-1')
  })

  it('reads the own history from the student route and a student history from the staff route', async () => {
    vi.mocked(quizRequests.topicHistory).mockResolvedValue(HISTORY)
    vi.mocked(quizRequests.studentTopicHistory).mockResolvedValue(HISTORY)

    const own = await progressRepository.topicHistory(OWN, 't-1')
    await progressRepository.topicHistory(STAFF, 't-1')

    expect(own).toEqual({
      points: 100, tier: 'bronze', nextTier: { tier: 'silver', points: 150 },
      attempts: [{
        id: 'a-2', startedAt: '2026-10-02T10:00:00+00:00', completedAt: '2026-10-02T10:10:00+00:00',
        total: 10, answered: 10, correct: 7, pointsBefore: 60, pointsAfter: 100, pointsChange: 40,
        tierBefore: 'bronze', tierAfter: 'bronze',
      }],
    })
    expect(quizRequests.topicHistory).toHaveBeenCalledWith('t-1')
    expect(quizRequests.studentTopicHistory).toHaveBeenCalledWith('c-1', 'u-9', 't-1')
  })

  it('maps wrong questions from either route', async () => {
    const wrong = [{
      question_id: 'q-1', type: 'multiple_choice' as const, statement: 'Símbolo do sódio?',
      options: [{ id: 'o-1', text: 'Na' }, { id: 'o-2', text: 'S' }],
      chosen_option_id: 'o-2', correct_option_id: 'o-1', explanation: null, answered_at: '2026-10-02T10:01:00+00:00',
    }]
    vi.mocked(quizRequests.wrongQuestions).mockResolvedValue(wrong)
    vi.mocked(quizRequests.studentWrongQuestions).mockResolvedValue(wrong)

    expect(await progressRepository.wrongQuestions(OWN, 't-1')).toEqual([{
      questionId: 'q-1', type: 'multiple_choice', statement: 'Símbolo do sódio?',
      options: [{ id: 'o-1', text: 'Na' }, { id: 'o-2', text: 'S' }],
      chosenOptionId: 'o-2', correctOptionId: 'o-1', explanation: null, answeredAt: '2026-10-02T10:01:00+00:00',
    }])
    await progressRepository.wrongQuestions(STAFF, 't-1')
    expect(quizRequests.studentWrongQuestions).toHaveBeenCalledWith('c-1', 'u-9', 't-1')
  })

  it('maps the classroom grid', async () => {
    vi.mocked(quizRequests.classroomProgress).mockResolvedValue({ students: [{ id: 'u-1', name: 'Carla', username: 'carla.dias', topics: [{ topic_id: 't-1', points: 60, tier: 'bronze' }] }] })

    expect(await progressRepository.classroomProgress('c-1')).toEqual([
      { id: 'u-1', name: 'Carla', username: 'carla.dias', topics: [{ topicId: 't-1', points: 60, tier: 'bronze' }] },
    ])
  })

  it('reads an attempt through the quiz route or the staff route', async () => {
    vi.mocked(quizRequests.get).mockResolvedValue(ATTEMPT)
    vi.mocked(quizRequests.studentAttempt).mockResolvedValue(ATTEMPT)

    expect((await progressRepository.attempt(OWN, 'a-1')).id).toBe('a-1')
    await progressRepository.attempt(STAFF, 'a-1')

    expect(quizRequests.get).toHaveBeenCalledWith('a-1')
    expect(quizRequests.studentAttempt).toHaveBeenCalledWith('c-1', 'u-9', 'a-1')
  })
})

describe('progress domain', () => {
  const NEWEST: AttemptSummary = { id: 'a-1', startedAt: 's', completedAt: 'c', total: 10, answered: 10, correct: 6, pointsBefore: 0, pointsAfter: 60, pointsChange: 60, tierBefore: 'iron', tierAfter: 'bronze' }
  const history = (over: Partial<AttemptSummary>): TopicHistory => ({ points: 60, tier: 'bronze', nextTier: { tier: 'silver', points: 150 }, attempts: [{ ...NEWEST, ...over }] })

  it('a level-up is the newest finished attempt that raised the tier', () => {
    expect(levelUpOf(history({}))?.id).toBe('a-1')
  })

  it('no level-up when the tier dropped, stayed, the attempt is open, or there is none', () => {
    expect(levelUpOf(history({ tierBefore: 'silver', tierAfter: 'bronze' }))).toBeNull()
    expect(levelUpOf(history({ tierBefore: 'bronze', tierAfter: 'bronze' }))).toBeNull()
    expect(levelUpOf(history({ completedAt: null }))).toBeNull()
    expect(levelUpOf(EMPTY_HISTORY)).toBeNull()
  })

  it('thresholds match the backend', () => {
    expect(TIER_THRESHOLDS).toEqual({ iron: 0, bronze: 50, silver: 150, gold: 300, emerald: 500, diamond: 800 })
  })
})
