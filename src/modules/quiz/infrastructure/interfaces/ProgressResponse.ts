/** Mirrors the progress endpoints' `data`. Tier codes stay strings until mapped. */
export interface NextTierResponse {
  tier: string
  points: number
}

export interface TopicProgressResponse {
  topic_id: string
  points: number
  tier: string
  next_tier: NextTierResponse | null
}

export interface AttemptSummaryResponse {
  id: string
  started_at: string
  completed_at: string | null
  total: number
  answered: number
  correct: number
  points_before: number
  points_after: number
  points_change: number
  tier_before: string
  tier_after: string
}

export interface TopicHistoryResponse {
  points: number
  tier: string
  next_tier: NextTierResponse | null
  attempts: AttemptSummaryResponse[]
}

export interface WrongQuestionResponse {
  question_id: string
  type: 'multiple_choice' | 'true_false'
  statement: string
  options: { id: string; text: string }[]
  chosen_option_id: string
  correct_option_id: string
  explanation: string | null
  answered_at: string
}

export interface ClassroomProgressResponse {
  students: { id: string; name: string; username: string; topics: { topic_id: string; points: number; tier: string }[] }[]
}
