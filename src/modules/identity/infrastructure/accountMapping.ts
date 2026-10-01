import type { IssuedAccount } from '@/modules/identity/domain/IssuedAccount'
import type { AccountResponse } from '@/modules/identity/infrastructure/interfaces/AccountResponse'

export const toIssuedAccount = (response: AccountResponse): IssuedAccount => ({
  id: response.id,
  name: response.name,
  login: response.login,
  temporaryPassword: response.temporary_password,
})
