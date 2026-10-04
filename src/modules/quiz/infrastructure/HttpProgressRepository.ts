import { quizRequests } from '@/modules/quiz/infrastructure/client/requests'
import { toAttempt } from '@/modules/quiz/infrastructure/attemptMapping'
import { isTier, type NextTier, type Tier, type TopicHistory, type TopicProgress, type WrongQuestion } from '@/modules/quiz/domain/Progress'
import type { ProgressRepository } from '@/modules/quiz/domain/ProgressRepository'
import type { NextTierResponse, TopicHistoryResponse, TopicProgressResponse, WrongQuestionResponse } from '@/modules/quiz/infrastructure/interfaces/ProgressResponse'

// A tier this build does not know (a newer backend) shows as the first one rather than breaking the page.
const toTier = (code: string): Tier => (isTier(code) ? code : 'iron')

const toNext = (next: NextTierResponse | null): NextTier | null => (next === null ? null : { tier: toTier(next.tier), points: next.points })

const toTopicProgress = (r: TopicProgressResponse): TopicProgress => ({ topicId: r.topic_id, points: r.points, tier: toTier(r.tier), nextTier: toNext(r.next_tier) })

const toHistory = (r: TopicHistoryResponse): TopicHistory => ({
  points: r.points,
  tier: toTier(r.tier),
  nextTier: toNext(r.next_tier),
  attempts: r.attempts.map((a) => ({
    id: a.id,
    startedAt: a.started_at,
    completedAt: a.completed_at,
    total: a.total,
    answered: a.answered,
    correct: a.correct,
    pointsBefore: a.points_before,
    pointsAfter: a.points_after,
    pointsChange: a.points_change,
    tierBefore: toTier(a.tier_before),
    tierAfter: toTier(a.tier_after),
  })),
})

const toWrong = (r: WrongQuestionResponse): WrongQuestion => ({
  questionId: r.question_id,
  type: r.type,
  statement: r.statement,
  options: r.options.map((o) => ({ id: o.id, text: o.text })),
  chosenOptionId: r.chosen_option_id,
  correctOptionId: r.correct_option_id,
  explanation: r.explanation,
  answeredAt: r.answered_at,
})

export const progressRepository: ProgressRepository = {
  async subjectProgress(subjectId) {
    return (await quizRequests.subjectProgress(subjectId)).map(toTopicProgress)
  },

  async topicHistory(source, topicId) {
    return toHistory(source.kind === 'own'
      ? await quizRequests.topicHistory(topicId)
      : await quizRequests.studentTopicHistory(source.classroomId, source.studentId, topicId))
  },

  async wrongQuestions(source, topicId) {
    const rows = source.kind === 'own'
      ? await quizRequests.wrongQuestions(topicId)
      : await quizRequests.studentWrongQuestions(source.classroomId, source.studentId, topicId)

    return rows.map(toWrong)
  },

  async attempt(source, attemptId) {
    return toAttempt(source.kind === 'own'
      ? await quizRequests.get(attemptId)
      : await quizRequests.studentAttempt(source.classroomId, source.studentId, attemptId))
  },

  async classroomProgress(classroomId) {
    return (await quizRequests.classroomProgress(classroomId)).students.map((s) => ({
      id: s.id,
      name: s.name,
      username: s.username,
      topics: s.topics.map((t) => ({ topicId: t.topic_id, points: t.points, tier: toTier(t.tier) })),
    }))
  },
}
