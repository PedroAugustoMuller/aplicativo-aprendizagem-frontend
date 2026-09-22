import type { Role } from '@/modules/identity/domain/Session'

export interface AccountSummary {
  readonly id: string
  readonly name: string
  readonly login: string
  readonly mustChangePassword: boolean
  readonly active: boolean
}

export interface AccountDetail extends AccountSummary {
  readonly role: Role
  /** Present while the account still holds a password nobody chose; null afterwards. */
  readonly temporaryPassword: string | null
}

export interface CredentialSlip {
  readonly userId: string
  readonly name: string
  readonly login: string
  readonly temporaryPassword: string
}
