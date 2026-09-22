import type { AccountDetail, AccountSummary } from '@/modules/identity/domain/Account'

/**
 * The port the offline adapter will implement. Keeping the page behind this
 * interface is why RNF03 will not require rewriting the page.
 */
export interface TeacherRepository {
  list(): Promise<AccountSummary[]>
  create(input: { id: string; name: string; email: string }): Promise<AccountDetail>
  resetPassword(id: string): Promise<AccountDetail>
  setActive(id: string, active: boolean): Promise<AccountDetail>
}
