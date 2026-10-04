<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { mdiBookOpenPageVariant } from '@mdi/js'
import { useProgressStore } from '@/modules/quiz/application/progressStore'
import { useQuizStore } from '@/modules/quiz/application/quizStore'
import { progressLinks } from '@/modules/quiz/application/progressRoutes'
import { TIER_THRESHOLDS, type AttemptSummary, type ProgressSource } from '@/modules/quiz/domain/Progress'
import ApiErrorAlert from '@/shared/ui/ApiErrorAlert.vue'
import OfflineBanner from '@/shared/ui/OfflineBanner.vue'
import TierBadge from '@/modules/quiz/presentation/TierBadge.vue'
import LevelUpDialog from '@/modules/quiz/presentation/LevelUpDialog.vue'

const props = defineProps<{
  topicId: string
  subjectId: string
  topicName: string
  source: ProgressSource
  studentName?: string | undefined
}>()

const { t, locale } = useI18n()
const store = useProgressStore()
const quiz = useQuizStore()
const own = computed(() => props.source.kind === 'own')
const links = computed(() => progressLinks(props.source, props.subjectId, props.topicId))
const history = computed(() => store.history)

const toNext = computed(() => {
  const h = history.value

  if (h === null) {
    return ''
  }

  return h.nextTier === null
    ? t('progress.maxTier')
    : t('progress.toNext', { missing: h.nextTier.points - h.points, tier: t(`progress.tier.${h.nextTier.tier}`) })
})

// From where the current tier starts to where the next one does.
const barValue = computed(() => {
  const h = history.value

  if (h === null || h.nextTier === null) {
    return 100
  }

  const floor = TIER_THRESHOLDS[h.tier]

  return Math.round(((h.points - floor) / (h.nextTier.points - floor)) * 100)
})

function change(attempt: AttemptSummary): string {
  if (attempt.pointsChange > 0) {
    return `+${attempt.pointsChange}`
  }

  return attempt.pointsChange < 0 ? `−${Math.abs(attempt.pointsChange)}` : '0'
}

function changeClass(attempt: AttemptSummary): string {
  if (attempt.pointsChange > 0) {
    return 'text-success'
  }

  return attempt.pointsChange < 0 ? 'text-error' : ''
}

function date(iso: string): string {
  return new Date(iso).toLocaleDateString(locale.value, { day: '2-digit', month: '2-digit' })
}

/** Staff never open an unfinished quiz: its unanswered questions are the student's to see. */
function linkOf(attempt: AttemptSummary): string | undefined {
  if (attempt.completedAt !== null) {
    return links.value.attempt(attempt.id)
  }

  return own.value ? `/quiz/${attempt.id}` : undefined
}

const load = (): Promise<void> => store.loadTopic(props.source, props.topicId, { celebrate: own.value })

watch(() => [props.topicId, props.source], load, { immediate: true })

// The outbox just sent something: the points on screen are out of date.
watch(() => quiz.pendingCount, (now, before) => {
  if (own.value && now < before) {
    void load()
  }
})
</script>

<template>
  <div>
    <p
      v-if="studentName"
      class="text-medium-emphasis mb-1"
      data-testid="progress-student"
    >
      {{ t('progress.studentTitle', { name: studentName }) }}
    </p>
    <h1
      class="text-h5 mb-4"
      data-testid="progress-title"
    >
      {{ topicName }}
    </h1>

    <OfflineBanner :saved-at="store.savedAt" />
    <v-alert
      v-if="own && quiz.pendingCount > 0"
      type="info"
      variant="tonal"
      density="compact"
      class="mb-4"
      data-testid="progress-pending"
      :text="t('progress.pendingNotice')"
    />

    <v-progress-linear
      v-if="store.loading && !history"
      indeterminate
    />
    <ApiErrorAlert
      v-else-if="store.error && !history"
      :error="store.error"
      testid="progress"
      @retry="load"
    />

    <template v-else-if="history">
      <v-card
        variant="flat"
        class="pa-4 mb-4 text-center"
      >
        <TierBadge
          :tier="history.tier"
          :points="history.points"
          size="large"
        />
        <v-progress-linear
          :model-value="barValue"
          height="10"
          rounded
          color="primary"
          class="mt-4"
          data-testid="progress-bar"
        />
        <div
          class="mt-2"
          data-testid="progress-to-next"
        >
          {{ toNext }}
        </div>
      </v-card>

      <v-btn
        block
        color="primary"
        variant="tonal"
        :prepend-icon="mdiBookOpenPageVariant"
        :to="links.wrong"
        :disabled="store.wrong.length === 0"
        class="mb-6"
        data-testid="progress-review-wrong"
      >
        {{ t('progress.reviewWrong', { count: store.wrong.length }) }}
      </v-btn>

      <h2 class="text-h6 mb-2">
        {{ t('progress.quizzes') }}
      </h2>
      <p
        v-if="history.attempts.length === 0"
        class="text-medium-emphasis"
        data-testid="progress-empty"
      >
        {{ t('progress.noQuizzes') }}
      </p>
      <v-list
        v-else
        density="comfortable"
      >
        <v-list-item
          v-for="(attempt, index) in history.attempts"
          :key="attempt.id"
          :to="linkOf(attempt)"
          :data-testid="`progress-attempt-${index}`"
        >
          <v-list-item-title>
            {{ t('progress.quizRow', { date: date(attempt.startedAt), correct: attempt.correct, total: attempt.total }) }}
          </v-list-item-title>
          <template #append>
            <v-chip
              v-if="attempt.completedAt === null"
              size="small"
            >
              {{ t('progress.inProgress') }}
            </v-chip>
            <span
              v-else
              :class="changeClass(attempt)"
              :data-testid="`progress-attempt-change-${index}`"
            >{{ change(attempt) }}</span>
          </template>
        </v-list-item>
      </v-list>
    </template>
    <LevelUpDialog />
  </div>
</template>
