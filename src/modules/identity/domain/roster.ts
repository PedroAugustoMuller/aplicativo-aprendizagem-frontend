/** The backend's limits (CreateStudentsRequest): 1–50 rows, names up to 120 characters. */
export const MAX_BATCH = 50
export const MAX_NAME_LENGTH = 120

export interface RosterPreview {
  readonly names: readonly string[]
  readonly tooLong: readonly string[]
  /** Repeated names are allowed (two students can share a name); they are only pointed out. */
  readonly duplicates: readonly string[]
}

/** One name per line, as pasted from the school's roster. */
export function parseRoster(text: string): RosterPreview {
  const names = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line !== '')

  const seen = new Set<string>()
  const flagged = new Set<string>()
  const duplicates: string[] = []

  for (const name of names) {
    const key = name.toLocaleLowerCase('pt-BR')

    if (seen.has(key) && !flagged.has(key)) {
      flagged.add(key)
      duplicates.push(name)
    }

    seen.add(key)
  }

  return { names, tooLong: names.filter((name) => name.length > MAX_NAME_LENGTH), duplicates }
}
