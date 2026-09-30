export interface Subject {
  readonly id: string
  readonly name: string
  /** Staff also receive deactivated subjects; students never do. */
  readonly active: boolean
}
