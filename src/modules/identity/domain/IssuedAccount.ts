/** An account the server just created or reset. The temporary password is shown once. */
export interface IssuedAccount {
  readonly id: string
  readonly name: string
  readonly login: string
  readonly temporaryPassword: string | null
}
