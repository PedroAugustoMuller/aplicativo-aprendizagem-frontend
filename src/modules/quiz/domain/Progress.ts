import type { QuizOption, QuizQuestionType } from '@/modules/quiz/domain/Attempt'

/** Ascending; the backend sends these codes, the screens translate them. */
export const TIERS = ['iron', 'bronze', 'silver', 'gold', 'emerald', 'diamond'] as const
export type Tier = (typeof TIERS)[number]

/** Where each tier starts. The server decides the tier; this only draws the progress bar. */
export const TIER_THRESHOLDS: Readonly<Record<Tier, number>> = { iron: 0, bronze: 50, silver: 150, gold: 300, emerald: 500, diamond: 800 }

export interface NextTier {
  readonly tier: Tier
  readonly points: number
}

export interface TopicProgress {
  readonly topicId: string
  readonly points: number
  readonly tier: Tier
  readonly nextTier: NextTier | null
}

export interface AttemptSummary {
  readonly id: string
  readonly startedAt: string
  readonly completedAt: string | null
  readonly total: number
  readonly answered: number
  readonly correct: number
  readonly pointsBefore: number
  readonly pointsAfter: number
  readonly pointsChange: number
  readonly tierBefore: Tier
  readonly tierAfter: Tier
}

export interface TopicHistory {
  readonly points: number
  readonly tier: Tier
  readonly nextTier: NextTier | null
  /** Newest first. */
  readonly attempts: readonly AttemptSummary[]
}

/** A question whose latest answer was wrong: the study list. */
export interface WrongQuestion {
  readonly questionId: string
  readonly type: QuizQuestionType
  readonly statement: string
  readonly options: readonly QuizOption[]
  readonly chosenOptionId: string
  readonly correctOptionId: string
  readonly explanation: string | null
  readonly answeredAt: string
}

export interface StudentTopicTier {
  readonly topicId: string
  readonly points: number
  readonly tier: Tier
}

export interface StudentProgress {
  readonly id: string
  readonly name: string
  readonly username: string
  readonly topics: readonly StudentTopicTier[]
}

/** Whose progress a page shows: the viewer's own, or a classroom student's (staff). */
export type ProgressSource =
  | { readonly kind: 'own' }
  | { readonly kind: 'student'; readonly classroomId: string; readonly studentId: string }

export const OWN: ProgressSource = { kind: 'own' }

export const EMPTY_HISTORY: TopicHistory = { points: 0, tier: 'iron', nextTier: { tier: 'bronze', points: 50 }, attempts: [] }

export function isTier(value: string): value is Tier {
  return (TIERS as readonly string[]).includes(value)
}

export function tierRank(tier: Tier): number {
  return TIERS.indexOf(tier)
}

/** Attempts come newest first; only the newest one can be "the quiz that just leveled up". */
export function levelUpOf(history: TopicHistory): AttemptSummary | null {
  const newest = history.attempts[0]

  if (newest === undefined || newest.completedAt === null || tierRank(newest.tierAfter) <= tierRank(newest.tierBefore)) {
    return null
  }

  return newest
}
