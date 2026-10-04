import { ref } from 'vue'
import { defineStore } from 'pinia'
import { progressRepository } from '@/modules/quiz/infrastructure/HttpProgressRepository'
import { quizVault } from '@/modules/quiz/infrastructure/persistence/quizVault'
import { readThrough } from '@/shared/offline/readThrough'
import { viewerId } from '@/shared/auth/viewer'
import { ApiError } from '@/shared/api/error'
import { levelUpOf, type ProgressSource, type StudentProgress, type Tier, type TopicHistory, type TopicProgress, type WrongQuestion } from '@/modules/quiz/domain/Progress'
import type { Attempt } from '@/modules/quiz/domain/Attempt'

const asApiError = (failure: unknown): ApiError => (failure instanceof ApiError ? failure : new ApiError('system.unexpected_error'))

// Staff copies of a student must never answer for the viewer's own, and vice versa.
const scopeOf = (source: ProgressSource): string => (source.kind === 'own' ? 'own' : `${source.classroomId}/${source.studentId}`)

export const useProgressStore = defineStore('progress', () => {
  const subjectTiers = ref<Record<string, TopicProgress>>({})
  /** The subject the tiers belong to; null while loading another one or after a failure. */
  const subjectTiersFor = ref<string | null>(null)

  const history = ref<TopicHistory | null>(null)
  const wrong = ref<WrongQuestion[]>([])
  const savedAt = ref<Date | null>(null)
  const loading = ref(false)
  const error = ref<ApiError | null>(null)

  const reviewed = ref<Attempt | null>(null)
  const reviewSavedAt = ref<Date | null>(null)
  const reviewLoading = ref(false)
  const reviewError = ref<ApiError | null>(null)

  const classroom = ref<StudentProgress[]>([])
  const classroomSavedAt = ref<Date | null>(null)
  const classroomLoading = ref(false)
  const classroomError = ref<ApiError | null>(null)

  const celebration = ref<Tier | null>(null)

  // Only the latest load of each kind may write; an older, slower response loses.
  let latestSubject = 0
  let latestTopic = 0
  let latestAttempt = 0
  let latestClassroom = 0
  // What the data on screen belongs to: a load for anything else clears it first, so a
  // page never shows the previous topic, student, attempt or classroom under a new title.
  let topicKey: string | null = null
  let attemptKey: string | null = null
  let classroomKey: string | null = null

  /** Badges are a bonus on the topic list: if they cannot load, the list just shows none. */
  async function loadSubject(subjectId: string): Promise<void> {
    const request = ++latestSubject

    if (subjectTiersFor.value !== subjectId) {
      subjectTiersFor.value = null
      subjectTiers.value = {}
    }

    try {
      const snapshot = await readThrough(`quiz:progress:subject:${subjectId}`, () => progressRepository.subjectProgress(subjectId))

      if (request === latestSubject) {
        subjectTiers.value = Object.fromEntries(snapshot.value.map((p) => [p.topicId, p]))
        subjectTiersFor.value = subjectId
      }
    } catch {
      if (request === latestSubject) {
        subjectTiers.value = {}
        subjectTiersFor.value = null
      }
    }
  }

  async function celebrateIfNew(next: TopicHistory): Promise<void> {
    const attempt = levelUpOf(next)
    const userId = viewerId()

    if (attempt === null || userId === null) {
      return
    }

    // A failing device store must not hide the moment: show it, and maybe show it again later.
    const seen = await quizVault.celebrated(userId, attempt.id).catch(() => false)

    if (!seen) {
      celebration.value = attempt.tierAfter
      await quizVault.markCelebrated(userId, attempt.id).catch(() => undefined)
    }
  }

  async function loadTopic(source: ProgressSource, topicId: string, options: { celebrate?: boolean } = {}): Promise<void> {
    const request = ++latestTopic
    const scope = scopeOf(source)
    const key = `${scope}:${topicId}`

    if (topicKey !== key) {
      topicKey = key
      history.value = null
      wrong.value = []
      savedAt.value = null
    }

    loading.value = true
    error.value = null

    try {
      const [h, w] = await Promise.all([
        readThrough(`quiz:progress:history:${scope}:${topicId}`, () => progressRepository.topicHistory(source, topicId)),
        readThrough(`quiz:progress:wrong:${scope}:${topicId}`, () => progressRepository.wrongQuestions(source, topicId)),
      ])

      if (request !== latestTopic) {
        return
      }

      history.value = h.value
      wrong.value = w.value
      savedAt.value = h.savedAt ?? w.savedAt

      // Only fresh server data: a stale offline copy never announces a level-up.
      if (options.celebrate === true && source.kind === 'own' && h.savedAt === null) {
        await celebrateIfNew(h.value)
      }
    } catch (failure: unknown) {
      if (request === latestTopic) {
        error.value = asApiError(failure)
        history.value = null
        wrong.value = []
        savedAt.value = null
      }
    } finally {
      if (request === latestTopic) {
        loading.value = false
      }
    }
  }

  async function loadAttempt(source: ProgressSource, attemptId: string): Promise<void> {
    const request = ++latestAttempt
    const key = `${scopeOf(source)}:${attemptId}`

    if (attemptKey !== key) {
      attemptKey = key
      reviewed.value = null
      reviewSavedAt.value = null
    }

    reviewLoading.value = true
    reviewError.value = null

    try {
      const snapshot = await readThrough(`quiz:progress:attempt:${scopeOf(source)}:${attemptId}`, () => progressRepository.attempt(source, attemptId))

      if (request === latestAttempt) {
        reviewed.value = snapshot.value
        reviewSavedAt.value = snapshot.savedAt
      }
    } catch (failure: unknown) {
      if (request === latestAttempt) {
        reviewError.value = asApiError(failure)
        reviewed.value = null
        reviewSavedAt.value = null
      }
    } finally {
      if (request === latestAttempt) {
        reviewLoading.value = false
      }
    }
  }

  async function loadClassroom(classroomId: string): Promise<void> {
    const request = ++latestClassroom

    if (classroomKey !== classroomId) {
      classroomKey = classroomId
      classroom.value = []
      classroomSavedAt.value = null
    }

    classroomLoading.value = true
    classroomError.value = null

    try {
      const snapshot = await readThrough(`quiz:progress:classroom:${classroomId}`, () => progressRepository.classroomProgress(classroomId))

      if (request === latestClassroom) {
        classroom.value = snapshot.value
        classroomSavedAt.value = snapshot.savedAt
      }
    } catch (failure: unknown) {
      if (request === latestClassroom) {
        classroomError.value = asApiError(failure)
        classroom.value = []
        classroomSavedAt.value = null
      }
    } finally {
      if (request === latestClassroom) {
        classroomLoading.value = false
      }
    }
  }

  function dismissCelebration(): void {
    celebration.value = null
  }

  function reset(): void {
    latestSubject += 1
    latestTopic += 1
    latestAttempt += 1
    latestClassroom += 1
    topicKey = null
    attemptKey = null
    classroomKey = null
    subjectTiers.value = {}
    subjectTiersFor.value = null
    history.value = null
    wrong.value = []
    savedAt.value = null
    loading.value = false
    error.value = null
    reviewed.value = null
    reviewSavedAt.value = null
    reviewLoading.value = false
    reviewError.value = null
    classroom.value = []
    classroomSavedAt.value = null
    classroomLoading.value = false
    classroomError.value = null
    celebration.value = null
  }

  return {
    subjectTiers,
    subjectTiersFor,
    history,
    wrong,
    savedAt,
    loading,
    error,
    reviewed,
    reviewSavedAt,
    reviewLoading,
    reviewError,
    classroom,
    classroomSavedAt,
    classroomLoading,
    classroomError,
    celebration,
    loadSubject,
    loadTopic,
    loadAttempt,
    loadClassroom,
    dismissCelebration,
    reset,
  }
})
