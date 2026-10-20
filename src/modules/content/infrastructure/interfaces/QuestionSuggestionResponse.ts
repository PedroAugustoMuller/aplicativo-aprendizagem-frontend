/** Mirrors POST /topics/{id}/question-suggestions. Network shape, not domain shape. */
export interface QuestionSuggestionBody {
  count: number
  types: string[]
  difficulty: string
  notes: string | null
  source_text: string | null
}

export type QuestionSuggestionResponse =
  | { type: 'multiple_choice'; statement: string; explanation: string | null; options: { text: string; correct: boolean }[] }
  | { type: 'true_false'; statement: string; explanation: string | null; correct: boolean }

export type QuestionSuggestionListResponse = QuestionSuggestionResponse[]
