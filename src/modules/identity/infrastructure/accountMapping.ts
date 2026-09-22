import type { Role } from '@/modules/identity/domain/Session'
import type { AccountDetail, AccountSummary, CredentialSlip } from '@/modules/identity/domain/Account'
import type {
  AccountDetailResponse,
  AccountSummaryResponse,
  CredentialSlipResponse,
} from '@/modules/identity/infrastructure/interfaces/AccountResponse'
import { ApiError } from '@/shared/api/error'

const ROLES: readonly Role[] = ['admin', 'teacher', 'student']

export const toRole = (value: string): Role => {
  const role = ROLES.find((candidate) => candidate === value)
  if (role === undefined) {
    // An unknown role is a contract break, not a user error.
    throw new ApiError('api.unexpected_response')
  }
  return role
}

export const toAccountSummary = (response: AccountSummaryResponse): AccountSummary => ({
  id: response.id,
  name: response.name,
  login: response.login,
  mustChangePassword: response.must_change_password,
  active: response.active,
})

export const toAccountDetail = (response: AccountDetailResponse): AccountDetail => ({
  ...toAccountSummary(response),
  role: toRole(response.role),
  temporaryPassword: response.temporary_password,
})

export const toCredentialSlip = (response: CredentialSlipResponse): CredentialSlip => ({
  userId: response.user_id,
  name: response.name,
  login: response.login,
  temporaryPassword: response.temporary_password,
})
