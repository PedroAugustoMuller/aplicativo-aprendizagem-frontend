<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { mdiCheckCircle } from '@mdi/js'
import { useProgressStore } from '@/modules/quiz/application/progressStore'
import type { SummaryScope } from '@/modules/quiz/domain/Progress'
import ApiErrorAlert from '@/shared/ui/ApiErrorAlert.vue'
import OfflineBanner from '@/shared/ui/OfflineBanner.vue'

type Scope = 'classroom' | 'all'
type Band = 'low' | 'mid' | 'high'

const props = defineProps<{
  classroomId: string
  classroomName: string
  topicId: string
  topicName: string
  scope: Scope
  /** An admin's "all" is every classroom of the subject, a teacher's only their own. */
  admin: boolean
}>()
const emit = defineEmits<{ 'update:scope': [scope: Scope] }>()
const { t } = useI18n()
const store = useProgressStore()

const summaryScope = computed((): SummaryScope => (props.scope === 'all' ? { kind: 'subject' } : { kind: 'classroom', classroomId: props.classroomId }))
const summary = computed(() => store.summary)
const empty = computed(() => summary.value !== null && summary.value.questions.length === 0)

// The number is always written next to the colour, so the band never carries meaning alone (RNF06).
const bandOf = (percent: number): Band => (percent > 60 ? 'high' : percent > 30 ? 'mid' : 'low')
const BAND_COLOR: Readonly<Record<Band, string>> = { low: 'secondary', mid: 'warning', high: 'error' }
const share = (count: number, of: number): number => (of === 0 ? 0 : (100 * count) / of)

const load = (): Promise<void> => store.loadSummary(summaryScope.value, props.topicId)

watch(() => [props.scope, props.classroomId, props.topicId], load, { immediate: true })
</script>

<template>
  <div>
    <h1 class="text-h5">
      {{ t('progress.questions.title', { topic: topicName }) }}
    </h1>
    <v-btn-toggle
      :model-value="scope"
      mandatory
      divided
      variant="outlined"
      density="comfortable"
      color="primary"
      class="my-3"
      @update:model-value="(value: Scope) => emit('update:scope', value)"
    >
      <v-btn
        value="classroom"
        data-testid="question-summary-scope-classroom"
      >
        {{ classroomName }}
      </v-btn>
      <v-btn
        value="all"
        data-testid="question-summary-scope-all"
      >
        {{ admin ? t('progress.questions.allSubject') : t('progress.questions.allMine') }}
      </v-btn>
    </v-btn-toggle>
    <OfflineBanner :saved-at="store.summarySavedAt" />
    <v-progress-linear
      v-if="store.summaryLoading && summary === null"
      indeterminate
    />
    <ApiErrorAlert
      v-else-if="store.summaryError && summary === null"
      :error="store.summaryError"
      testid="question-summary"
      @retry="load"
    />
    <template v-else-if="summary !== null">
      <p
        class="text-medium-emphasis mb-4"
        data-testid="question-summary-context"
      >
        {{ t('progress.questions.context', { students: summary.students, questions: summary.questions.length }) }}
      </p>
      <p
        v-if="empty"
        class="text-medium-emphasis"
        data-testid="question-summary-empty"
      >
        {{ t('progress.questions.empty') }}
      </p>
      <v-card
        v-for="question in summary.questions"
        :key="question.questionId"
        variant="outlined"
        class="mb-3"
        :data-testid="`question-summary-${question.questionId}`"
      >
        <v-card-text>
          <div class="text-body-1 mb-3">
            {{ question.statement }}
          </div>
          <div
            :data-testid="`question-summary-band-${question.questionId}`"
            :data-band="bandOf(question.wrongPercent)"
            class="mb-3"
          >
            <div class="d-flex flex-wrap justify-space-between ga-2 mb-1">
              <strong :class="bandOf(question.wrongPercent) === 'low' ? '' : `text-${BAND_COLOR[bandOf(question.wrongPercent)]}`">
                {{ t('progress.questions.wrong', { percent: question.wrongPercent }) }}
              </strong>
              <span class="text-medium-emphasis">
                {{ t('progress.questions.ofStudents', { wrong: question.wrong, answered: question.answered }) }}
              </span>
            </div>
            <v-progress-linear
              :model-value="question.wrongPercent"
              :color="BAND_COLOR[bandOf(question.wrongPercent)]"
              height="10"
              rounded
            />
          </div>
          <div
            v-for="option in question.options"
            :key="option.id"
            class="mb-2"
            :data-testid="`question-summary-option-${option.id}`"
          >
            <div class="d-flex flex-wrap justify-space-between ga-2 text-body-2">
              <span>
                <v-icon
                  v-if="option.id === question.correctOptionId"
                  :icon="mdiCheckCircle"
                  color="success"
                  size="small"
                />
                {{ option.text }}
                <span
                  v-if="option.id === question.correctOptionId"
                  class="text-success"
                >· {{ t('progress.questions.correct') }}</span>
              </span>
              <span class="text-medium-emphasis">{{ t('progress.questions.chosen', option.chosen) }}</span>
            </div>
            <v-progress-linear
              :model-value="share(option.chosen, question.answered)"
              :color="option.id === question.correctOptionId ? 'success' : 'secondary'"
              height="6"
              rounded
            />
          </div>
          <div
            v-if="question.otherChosen > 0"
            class="text-body-2 text-medium-emphasis"
            :data-testid="`question-summary-removed-${question.questionId}`"
          >
            {{ t('progress.questions.removed') }} — {{ t('progress.questions.chosen', question.otherChosen) }}
          </div>
        </v-card-text>
      </v-card>
    </template>
  </div>
</template>
