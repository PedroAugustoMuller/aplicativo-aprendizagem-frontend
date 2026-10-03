import type { Topic } from '@/modules/content/domain/Topic'

export interface TopicInput {
  readonly name: string
  readonly description: string
}

/**
 * The port the offline adapter will implement. Keeping the page behind this
 * interface is why RNF03 will not require rewriting the page.
 */
export interface TopicRepository {
  listBySubject(subjectId: string): Promise<Topic[]>
  create(subjectId: string, id: string, input: TopicInput): Promise<Topic>
  update(id: string, input: TopicInput): Promise<Topic>
  deactivate(id: string): Promise<Topic>
  reactivate(id: string): Promise<Topic>
  /** The whole order; the server refuses it (content.topic.order_stale) if the topics changed. */
  reorder(subjectId: string, ids: readonly string[]): Promise<Topic[]>
}
