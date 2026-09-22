import type { AccountDetail, AccountSummary, CredentialSlip } from '@/modules/identity/domain/Account'

/**
 * The port the offline adapter will implement. Keeping the page behind this
 * interface is why RNF03 will not require rewriting the page.
 */
export interface StudentRepository {
  listByClassroom(classroomId: string): Promise<AccountSummary[]>
  createInClassroom(classroomId: string, students: readonly { id: string; name: string }[]): Promise<AccountDetail[]>
  enrol(classroomId: string, studentId: string): Promise<void>
  unenrol(classroomId: string, studentId: string): Promise<void>
  resetPassword(studentId: string): Promise<AccountDetail>
  setActive(studentId: string, active: boolean): Promise<AccountDetail>
  credentials(classroomId: string): Promise<CredentialSlip[]>
}
