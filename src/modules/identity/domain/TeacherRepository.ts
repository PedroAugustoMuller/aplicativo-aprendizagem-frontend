import type { IssuedAccount } from '@/modules/identity/domain/IssuedAccount'
import type { NewTeacher, Teacher } from '@/modules/identity/domain/Teacher'

export interface TeacherRepository {
  list(): Promise<Teacher[]>
  create(input: NewTeacher): Promise<IssuedAccount>
  resetPassword(id: string): Promise<IssuedAccount>
  setActive(id: string, active: boolean): Promise<void>
}
