export interface Teacher {
  readonly id: string
  readonly name: string
  readonly email: string
  readonly mustChangePassword: boolean
  readonly active: boolean
}

export interface NewTeacher {
  /** Chosen by the client, so a retried create replays instead of duplicating. */
  readonly id: string
  readonly name: string
  readonly email: string
}
