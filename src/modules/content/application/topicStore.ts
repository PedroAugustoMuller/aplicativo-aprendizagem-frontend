import { ref } from 'vue'
import { defineStore } from 'pinia'
import { topicRepository } from '@/modules/content/infrastructure/HttpTopicRepository'
import { readThrough } from '@/shared/offline/readThrough'
import { ApiError } from '@/shared/api/error'
import type { Topic } from '@/modules/content/domain/Topic'
import type { TopicInput } from '@/modules/content/domain/TopicRepository'

export const useTopicStore = defineStore('topics', () => {
  const subjectId = ref<string | null>(null)
  const topics = ref<Topic[]>([])
  const savedAt = ref<Date | null>(null)
  const loading = ref(false)
  const error = ref<ApiError | null>(null)
  // Only the latest load() may write results; an older, slower response loses.
  let latest = 0

  async function load(nextSubjectId: string): Promise<void> {
    const request = ++latest

    if (subjectId.value !== nextSubjectId) {
      subjectId.value = nextSubjectId
      topics.value = []
      savedAt.value = null
    }

    loading.value = true
    error.value = null

    try {
      const snapshot = await readThrough(`content:topics:${nextSubjectId}`, () =>
        topicRepository.listBySubject(nextSubjectId),
      )

      if (request === latest) {
        topics.value = snapshot.value
        savedAt.value = snapshot.savedAt
      }
    } catch (failure: unknown) {
      if (request === latest) {
        error.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
        topics.value = []
        savedAt.value = null
      }
    } finally {
      if (request === latest) {
        loading.value = false
      }
    }
  }

  function currentSubject(): string {
    if (subjectId.value === null) {
      throw new ApiError('system.unexpected_error')
    }

    return subjectId.value
  }

  // Writes need a connection and let their ApiError reach whoever asked.
  async function create(id: string, input: TopicInput): Promise<void> {
    const current = currentSubject()
    await topicRepository.create(current, id, input)
    await load(current)
  }

  async function update(id: string, input: TopicInput): Promise<void> {
    const current = currentSubject()
    await topicRepository.update(id, input)
    await load(current)
  }

  async function setActive(id: string, active: boolean): Promise<void> {
    const current = currentSubject()
    await (active ? topicRepository.reactivate(id) : topicRepository.deactivate(id))
    await load(current)
  }

  /** One place up (-1) or down (+1); the server receives the whole new order. */
  async function move(id: string, direction: -1 | 1): Promise<void> {
    const current = currentSubject()
    const ids = topics.value.map((topic) => topic.id)
    const from = ids.indexOf(id)
    const moved = ids[from]
    const other = ids[from + direction]

    if (from < 0 || moved === undefined || other === undefined) {
      return
    }

    ids[from] = other
    ids[from + direction] = moved

    try {
      await topicRepository.reorder(current, ids)
    } catch (failure: unknown) {
      // Someone else changed the list: show theirs, then let the page say why.
      if (failure instanceof ApiError && failure.code === 'content.topic.order_stale') {
        await load(current)
      }

      throw failure
    }

    await load(current)
  }

  function reset(): void {
    // Bumping the counter makes any in-flight load() discard its result.
    latest += 1
    subjectId.value = null
    topics.value = []
    savedAt.value = null
    loading.value = false
    error.value = null
  }

  return { subjectId, topics, savedAt, loading, error, load, create, update, setActive, move, reset }
})
