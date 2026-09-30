import { contentRequests } from '@/modules/content/infrastructure/client/requests'
import type { Subject } from '@/modules/content/domain/Subject'
import type { SubjectRepository } from '@/modules/content/domain/SubjectRepository'
import type { SubjectResponse } from '@/modules/content/infrastructure/interfaces/SubjectListResponse'

const toDomain = (response: SubjectResponse): Subject => ({
  id: response.id,
  name: response.name,
  active: response.active,
})

export const subjectRepository: SubjectRepository = {
  async list(): Promise<Subject[]> {
    const response = await contentRequests.listSubjects()

    // Alphabetical order is a display guarantee we own, accents included.
    return response.map(toDomain).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  },
}
