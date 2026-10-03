/** Mirrors GET /topics/{id}/questions `data` elements and question write responses. */
export interface QuestionOptionResponse {
  id: string
  text: string
  correct: boolean
  position: number
}

export interface QuestionResponse {
  id: string
  topic_id: string
  type: 'multiple_choice' | 'true_false'
  statement: string
  explanation: string | null
  active: boolean
  version: number
  options: QuestionOptionResponse[]
}

export type QuestionListResponse = QuestionResponse[]

export interface QuestionOptionBody {
  id?: string
  text: string
  correct: boolean
}

export type QuestionContentBody =
  | { statement: string; explanation: string | null; options: QuestionOptionBody[] }
  | { statement: string; explanation: string | null; correct: boolean }

export type QuestionCreateBody = QuestionContentBody & { id: string; type: QuestionResponse['type'] }

export type QuestionUpdateBody = QuestionContentBody & { version: number }
