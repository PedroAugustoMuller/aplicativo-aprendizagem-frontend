import { extractText } from '@/modules/content/infrastructure/textExtraction/extractText'
import { SUGGESTION_LIMITS } from '@/modules/content/domain/QuestionSuggestion'

/** A teacher's file as source text, cut at what the API accepts. */
export async function readSourceFile(file: File): Promise<{ text: string; truncated: boolean }> {
  const text = await extractText(file)

  return text.length > SUGGESTION_LIMITS.sourceText
    ? { text: text.slice(0, SUGGESTION_LIMITS.sourceText), truncated: true }
    : { text, truncated: false }
}
