export interface Student {
  readonly id: string
  readonly name: string
  readonly username: string
  readonly mustChangePassword: boolean
  readonly active: boolean
}

export interface NewStudent {
  /** Chosen by the client, so a retried batch replays instead of duplicating. */
  readonly id: string
  readonly name: string
}

/** A printable access slip: the student's pending temporary password. */
export interface Credential {
  readonly userId: string
  readonly name: string
  readonly username: string
  readonly temporaryPassword: string
}
