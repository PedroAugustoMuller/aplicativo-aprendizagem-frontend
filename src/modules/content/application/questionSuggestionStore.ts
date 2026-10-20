import { ref } from 'vue'
import { defineStore } from 'pinia'
import { questionSuggestionRepository } from '@/modules/content/infrastructure/HttpQuestionSuggestionRepository'
import { useQuestionStore } from '@/modules/content/application/questionStore'
import { blankRequest, type QuestionSuggestion, type SuggestionRequest } from '@/modules/content/domain/QuestionSuggestion'
import type { Question } from '@/modules/content/domain/Question'

/**
 * Suggestions live in memory only: a reload or sign-out loses them and the bank
 * is untouched. They survive the trip to the edit form and back.
 */
export const useQuestionSuggestionStore = defineStore('questionSuggestions', () => {
  const byTopic = ref<Record<string, QuestionSuggestion[]>>({})
  const drafts = ref<Record<string, SuggestionRequest>>({})
  const questions = useQuestionStore()

  function list(topicId: string): QuestionSuggestion[] {
    return byTopic.value[topicId] ?? []
  }

  function find(topicId: string, key: string): QuestionSuggestion | null {
    return list(topicId).find((suggestion) => suggestion.key === key) ?? null
  }

  async function generate(topicId: string, request: SuggestionRequest): Promise<void> {
    const contents = await questionSuggestionRepository.suggest(topicId, request)
    const fresh = contents.map((content) => ({ key: globalThis.crypto.randomUUID(), content }))
    byTopic.value = { ...byTopic.value, [topicId]: [...list(topicId), ...fresh] }
  }

  function discard(topicId: string, key: string): void {
    byTopic.value = { ...byTopic.value, [topicId]: list(topicId).filter((suggestion) => suggestion.key !== key) }
  }

  // The key is the question id: a retry after a timeout replays the same create.
  async function accept(topicId: string, key: string): Promise<void> {
    const suggestion = find(topicId, key)

    if (suggestion === null) {
      return
    }

    if (questions.topicId !== topicId) {
      await questions.load(topicId)
    }

    await questions.create(suggestion.key, suggestion.content)
    discard(topicId, key)
  }

  async function acceptAll(topicId: string): Promise<void> {
    for (const suggestion of [...list(topicId)]) {
      await accept(topicId, suggestion.key)
    }
  }

  function draft(topicId: string): SuggestionRequest {
    const saved = drafts.value[topicId]

    return saved === undefined ? blankRequest() : { ...saved, types: [...saved.types] }
  }

  function saveDraft(topicId: string, request: SuggestionRequest): void {
    drafts.value = { ...drafts.value, [topicId]: { ...request, types: [...request.types] } }
  }

  function reset(): void {
    byTopic.value = {}
    drafts.value = {}
  }

  return { byTopic, drafts, list, find, generate, discard, accept, acceptAll, draft, saveDraft, reset }
})

/** A suggestion shaped like a bank question, so QuestionCard can show it unchanged. */
export function asPreview(suggestion: QuestionSuggestion, topicId: string): Question {
  const { content } = suggestion
  const options =
    content.type === 'true_false'
      ? [
          { id: `${suggestion.key}-v`, text: 'Verdadeiro', correct: content.answer },
          { id: `${suggestion.key}-f`, text: 'Falso', correct: !content.answer },
        ]
      : content.options.map((option, index) => ({ id: `${suggestion.key}-${index}`, text: option.text, correct: option.correct }))

  return {
    id: suggestion.key,
    topicId,
    type: content.type,
    statement: content.statement,
    explanation: content.explanation,
    active: true,
    version: 0,
    options,
  }
}
