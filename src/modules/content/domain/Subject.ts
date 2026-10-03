export interface Subject {
  readonly id: string
  readonly name: string
  /** Staff also receive deactivated subjects; students never do. */
  readonly active: boolean
  /** The viewer may write this subject's topics and questions (the admin, or one of its teachers). */
  readonly canAuthor: boolean
}
