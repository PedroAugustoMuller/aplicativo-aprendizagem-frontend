import { describe, expect, it } from 'vitest'
import { MAX_NAME_LENGTH, parseRoster } from '@/modules/identity/domain/roster'

describe('parseRoster', () => {
  it('reads one name per line, as pasted from a spreadsheet', () => {
    expect(parseRoster('Ana Lima\r\nBruno Kessler\r\n').names).toEqual(['Ana Lima', 'Bruno Kessler'])
  })

  it('ignores blank lines and tidies spaces and tabs', () => {
    expect(parseRoster('\n  Ana\t\tLima  \n\n   \nBruno  Kessler\n').names).toEqual(['Ana Lima', 'Bruno Kessler'])
  })

  it('flags a repeated name once, whatever its capitals, without dropping it', () => {
    const preview = parseRoster('Ana Lima\nana lima\nAna Lima\nBruno')

    expect(preview.names).toHaveLength(4)
    expect(preview.duplicates).toEqual(['ana lima'])
  })

  it('flags names longer than the backend accepts', () => {
    const long = 'A'.repeat(MAX_NAME_LENGTH + 1)

    expect(parseRoster(`Ana\n${long}`).tooLong).toEqual([long])
    expect(parseRoster('A'.repeat(MAX_NAME_LENGTH)).tooLong).toEqual([])
  })

  it('returns nothing for an empty paste', () => {
    expect(parseRoster(' \n\n')).toEqual({ names: [], tooLong: [], duplicates: [] })
  })
})
