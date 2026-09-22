export const MAX_STUDENTS_PER_BATCH = 50

export interface ParsedNameList {
  /** Trimmed, inner whitespace collapsed, in paste order, first occurrence kept. */
  readonly names: readonly string[]
  /** Names that appeared more than once (case- and accent-insensitive), each listed once. */
  readonly duplicates: readonly string[]
  readonly overLimit: boolean
}

const LIST_MARKER = /^(?:\d+\s*[.)-]|[-*•])\s*/u

const clean = (line: string): string => line.replace(LIST_MARKER, '').replace(/\s+/gu, ' ').trim()

/**
 * Case- and accent-insensitive comparison key, shared with the paste dialog so
 * it can look up the id minted for a name by the same rule the parser uses to
 * detect duplicates.
 */
export const nameKey = (name: string): string =>
  name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR')

export function parseNameList(text: string): ParsedNameList {
  const names: string[] = []
  const seen = new Map<string, string>()
  const duplicates = new Set<string>()

  for (const line of text.split(/\r?\n/u)) {
    const name = clean(line)
    if (name === '') {
      continue
    }
    const key = nameKey(name)
    const first = seen.get(key)
    if (first !== undefined) {
      duplicates.add(first)
      continue
    }
    seen.set(key, name)
    names.push(name)
  }

  return { names, duplicates: [...duplicates], overLimit: names.length > MAX_STUDENTS_PER_BATCH }
}
