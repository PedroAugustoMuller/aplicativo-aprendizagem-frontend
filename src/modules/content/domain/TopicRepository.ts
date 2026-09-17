import type { Topic } from '@/modules/content/domain/Topic'

/**
 * The port the offline adapter will implement. Keeping the page behind this
 * interface is why RNF03 will not require rewriting the page.
 */
export interface TopicRepository {
  list(): Promise<Topic[]>
}
