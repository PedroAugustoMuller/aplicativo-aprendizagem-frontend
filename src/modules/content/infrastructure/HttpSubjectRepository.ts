import { contentRequests } from '@/modules/content/infrastructure/client/requests'
import type { Subject } from '@/modules/content/domain/Subject'
import type { SubjectRepository } from '@/modules/content/domain/SubjectRepository'
import type { SubjectResponse } from '@/modules/content/infrastructure/interfaces/SubjectResponse'

const toDomain = (response: SubjectResponse): Subject => ({
  id: response.id,
  name: response.name,
  active: response.active,
})

export const subjectRepository: SubjectRepository = {
  async list(): Promise<Subject[]> {
    const response = await contentRequests.listSubjects()

    // Ordering is a display guarantee we own; do not depend on the server's order.
    return response.map(toDomain).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  },

  async create(input: { id: string; name: string }): Promise<Subject> {
    return toDomain(await contentRequests.createSubject({ id: input.id, name: input.name }))
  },

  async rename(id: string, name: string): Promise<Subject> {
    return toDomain(await contentRequests.renameSubject(id, { name }))
  },

  async deactivate(id: string): Promise<Subject> {
    return toDomain(await contentRequests.deactivateSubject(id))
  },
}
