import type { Subject } from '@/modules/content/domain/Subject'

/** The port an offline adapter will implement (RNF03). */
export interface SubjectRepository {
  list(): Promise<Subject[]>
  create(input: { id: string; name: string }): Promise<Subject>
  rename(id: string, name: string): Promise<Subject>
  deactivate(id: string): Promise<Subject>
}
