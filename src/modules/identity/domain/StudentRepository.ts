import type { IssuedAccount } from '@/modules/identity/domain/IssuedAccount'
import type { Credential, NewStudent, Student } from '@/modules/identity/domain/Student'

export interface StudentRepository {
  listByClassroom(classroomId: string): Promise<Student[]>
  createMany(classroomId: string, rows: readonly NewStudent[]): Promise<IssuedAccount[]>
  unenrol(classroomId: string, studentId: string): Promise<void>
  resetPassword(studentId: string): Promise<IssuedAccount>
  setActive(studentId: string, active: boolean): Promise<void>
  credentials(classroomId: string): Promise<Credential[]>
}
