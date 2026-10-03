/** Mirrors the quiz endpoints' `data`. */
export interface AnswerResultResponse {
  question_id: string
  option_id: string
  correct: boolean
  correct_option_id: string
  explanation: string | null
}

export interface ScoreResponse {
  total: number
  answered: number
  correct: number
}

export interface AttemptQuestionResponse {
  id: string
  position: number
  type: 'multiple_choice' | 'true_false'
  statement: string
  options: { id: string; text: string }[]
  result: AnswerResultResponse | null
}

export interface AttemptResponse {
  id: string
  topic_id: string
  started_at: string
  completed_at: string | null
  score: ScoreResponse
  questions: AttemptQuestionResponse[]
}

export type AnswerResponse = AnswerResultResponse & { score: ScoreResponse; completed: boolean }

export interface AnswerBody {
  answer_id: string
  question_id: string
  option_id: string
  answered_at: string
}
