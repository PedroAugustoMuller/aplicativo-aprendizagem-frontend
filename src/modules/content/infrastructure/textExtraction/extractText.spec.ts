import { beforeEach, describe, expect, it, vi } from 'vitest'
import { extractText } from '@/modules/content/infrastructure/textExtraction/extractText'
import { readSourceFile } from '@/modules/content/application/sourceFile'
import { SourceFileError } from '@/modules/content/domain/QuestionSuggestion'

const { pdfText, pptxText } = vi.hoisted(() => ({ pdfText: vi.fn(), pptxText: vi.fn() }))
vi.mock('@/modules/content/infrastructure/textExtraction/pdfText', () => ({ pdfText }))
vi.mock('@/modules/content/infrastructure/textExtraction/pptxText', () => ({ pptxText }))

const file = (name: string, size = 10, type = '') => {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })

  return f
}

const problem = async (promise: Promise<unknown>) => {
  try {
    await promise
  } catch (failure) {
    return failure instanceof SourceFileError ? failure.problem : 'other'
  }

  return 'none'
}

describe('extractText', () => {
  beforeEach(() => vi.resetAllMocks())

  it('reads a PDF by extension or type', async () => {
    pdfText.mockResolvedValue('Texto do PDF')

    expect(await extractText(file('Aula.PDF'))).toBe('Texto do PDF')
    expect(await extractText(file('sem-extensao', 10, 'application/pdf'))).toBe('Texto do PDF')
  })

  it('reads a PPTX', async () => {
    pptxText.mockResolvedValue('Slide')

    expect(await extractText(file('aula.pptx'))).toBe('Slide')
  })

  it('collapses runs of blank lines and trims', async () => {
    pdfText.mockResolvedValue('  a \n\n\n\n b  ')

    expect(await extractText(file('a.pdf'))).toBe('a\n\nb')
  })

  it('refuses files over 20 MB without reading them', async () => {
    expect(await problem(extractText(file('a.pdf', 20 * 1024 * 1024 + 1)))).toBe('too_large')
    expect(pdfText).not.toHaveBeenCalled()
  })

  it('refuses old .ppt, .docx and others', async () => {
    expect(await problem(extractText(file('a.ppt')))).toBe('unsupported')
    expect(await problem(extractText(file('a.docx')))).toBe('unsupported')
  })

  it('says when a file has no text (a scanned PDF)', async () => {
    pdfText.mockResolvedValue('   \n ')

    expect(await problem(extractText(file('scan.pdf')))).toBe('no_text')
  })

  it('says when a file cannot be read', async () => {
    pptxText.mockRejectedValue(new Error('corrupt zip'))

    expect(await problem(extractText(file('a.pptx')))).toBe('unreadable')
  })
})

describe('readSourceFile', () => {
  it('cuts the text at the source limit and says so', async () => {
    pdfText.mockResolvedValue('a'.repeat(30_005))

    const result = await readSourceFile(file('a.pdf'))

    expect(result.text).toHaveLength(30_000)
    expect(result.truncated).toBe(true)
  })
})
