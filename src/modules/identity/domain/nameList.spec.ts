import { describe, expect, it } from 'vitest'
import { MAX_STUDENTS_PER_BATCH, parseNameList } from '@/modules/identity/domain/nameList'

describe('parseNameList', () => {
  it('takes one name per line, trimming and collapsing whitespace', () => {
    expect(parseNameList('  Ana   Souza \n\tBia Lima\n').names).toEqual(['Ana Souza', 'Bia Lima'])
  })

  it('ignores blank lines and Windows line endings', () => {
    expect(parseNameList('Ana Souza\r\n\r\n   \r\nBia Lima').names).toEqual(['Ana Souza', 'Bia Lima'])
  })

  it('drops numbering and bullets pasted from a spreadsheet or a document', () => {
    expect(parseNameList('1. Ana Souza\n2) Bia Lima\n- Caio Reis\n• Dora Luz').names)
      .toEqual(['Ana Souza', 'Bia Lima', 'Caio Reis', 'Dora Luz'])
  })

  it('reports duplicates ignoring case and accents and keeps the first occurrence', () => {
    const parsed = parseNameList('João Silva\njoao silva\nAna Souza\nJOÃO SILVA')

    expect(parsed.names).toEqual(['João Silva', 'Ana Souza'])
    expect(parsed.duplicates).toEqual(['João Silva'])
  })

  it('flags a list above the batch limit without truncating it', () => {
    const text = Array.from({ length: MAX_STUDENTS_PER_BATCH + 1 }, (_, i) => `Aluno ${i + 1}`).join('\n')
    const parsed = parseNameList(text)

    expect(parsed.names).toHaveLength(MAX_STUDENTS_PER_BATCH + 1)
    expect(parsed.overLimit).toBe(true)
  })

  it('accepts exactly the limit', () => {
    const text = Array.from({ length: MAX_STUDENTS_PER_BATCH }, (_, i) => `Aluno ${i + 1}`).join('\n')

    expect(parseNameList(text).overLimit).toBe(false)
  })

  it('returns nothing for empty input', () => {
    expect(parseNameList('')).toEqual({ names: [], duplicates: [], overLimit: false })
  })
})
