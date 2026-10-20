import { contentRequests } from '@/modules/content/infrastructure/client/requests'
import type { QuestionContent } from '@/modules/content/domain/Question'
import type { QuestionSuggestionRepository } from '@/modules/content/domain/QuestionSuggestionRepository'
import type { QuestionSuggestionResponse } from '@/modules/content/infrastructure/interfaces/QuestionSuggestionResponse'

const toDomain = (response: QuestionSuggestionResponse): QuestionContent =>
  response.type === 'true_false'
    ? { type: 'true_false', statement: response.statement, explanation: response.explanation, answer: response.correct }
    : {
        type: 'multiple_choice',
        statement: response.statement,
        explanation: response.explanation,
        options: response.options.map((option) => ({ id: null, text: option.text, correct: option.correct })),
      }

const orNull = (value: string): string | null => (value.trim() === '' ? null : value)

export const questionSuggestionRepository: QuestionSuggestionRepository = {
  async suggest(topicId, request) {
    const response = await contentRequests.suggestQuestions(topicId, {
      count: request.count,
      types: [...request.types],
      difficulty: request.difficulty,
      notes: orNull(request.notes),
      source_text: orNull(request.sourceText),
    })

    return response.map(toDomain)
  },
}
