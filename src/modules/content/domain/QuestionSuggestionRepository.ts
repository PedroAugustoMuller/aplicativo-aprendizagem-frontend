import type { QuestionContent } from '@/modules/content/domain/Question'
import type { SuggestionRequest } from '@/modules/content/domain/QuestionSuggestion'

export interface QuestionSuggestionRepository {
  /** Online only. Nothing is saved: each accepted one goes through QuestionRepository.create. */
  suggest(topicId: string, request: SuggestionRequest): Promise<QuestionContent[]>
}
