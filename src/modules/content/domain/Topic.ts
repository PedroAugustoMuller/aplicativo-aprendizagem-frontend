export interface Topic {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly position: number
  /** Only authors ever receive deactivated topics. */
  readonly active: boolean
  /** Active questions in the bank; null when the viewer does not author the subject. */
  readonly questionCount: number | null
}
