import { SourceFileError, SUGGESTION_LIMITS } from '@/modules/content/domain/QuestionSuggestion'

// Loaded only when a teacher attaches a file: these chunks stay out of the PWA precache.
const readers = {
  pdf: async (data: ArrayBuffer) => (await import('@/modules/content/infrastructure/textExtraction/pdfText')).pdfText(data),
  pptx: async (data: ArrayBuffer) => (await import('@/modules/content/infrastructure/textExtraction/pptxText')).pptxText(data),
}

function kind(file: File): keyof typeof readers | null {
  const name = file.name.toLowerCase()

  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    return 'pdf'
  }

  return name.endsWith('.pptx') ? 'pptx' : null
}

export async function extractText(file: File): Promise<string> {
  if (file.size > SUGGESTION_LIMITS.fileBytes) {
    throw new SourceFileError('too_large')
  }

  const reader = kind(file)

  if (reader === null) {
    throw new SourceFileError('unsupported')
  }

  let raw: string

  try {
    raw = await readers[reader](await file.arrayBuffer())
  } catch {
    throw new SourceFileError('unreadable')
  }

  const text = raw
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (text === '') {
    throw new SourceFileError('no_text')
  }

  return text
}
