import type { Subject } from '@/modules/content/domain/Subject'

/**
 * The port the offline adapter will implement. Keeping the page behind this
 * interface is why RNF03 will not require rewriting the page.
 */
export interface SubjectRepository {
  list(): Promise<Subject[]>
  create(input: { id: string; name: string }): Promise<Subject>
  rename(id: string, name: string): Promise<Subject>
  deactivate(id: string): Promise<Subject>
}
