import { ref } from 'vue'
import { readSourceFile } from '@/modules/content/application/sourceFile'
import { SourceFileError, type SourceFileProblem } from '@/modules/content/domain/QuestionSuggestion'

/**
 * The hidden file input behind "Anexar PDF ou slides". Lives in a .ts file
 * because .vue files see no browser globals (Event, HTMLInputElement) in ESLint.
 */
export function useSourceFileInput(onText: (text: string) => void) {
  const fileInput = ref<HTMLInputElement | null>(null)
  const reading = ref(false)
  const truncated = ref(false)
  const fileProblem = ref<SourceFileProblem | null>(null)

  async function attach(event: Event): Promise<void> {
    const input = event.target instanceof HTMLInputElement ? event.target : null
    const file = input?.files?.[0]

    if (input === null || file === undefined) {
      return
    }

    reading.value = true
    fileProblem.value = null
    truncated.value = false

    try {
      const result = await readSourceFile(file)
      onText(result.text)
      truncated.value = result.truncated
    } catch (failure: unknown) {
      fileProblem.value = failure instanceof SourceFileError ? failure.problem : 'unreadable'
    } finally {
      reading.value = false
      // Picking the same file again must fire `change` again.
      input.value = ''
    }
  }

  return { fileInput, reading, truncated, fileProblem, attach }
}
