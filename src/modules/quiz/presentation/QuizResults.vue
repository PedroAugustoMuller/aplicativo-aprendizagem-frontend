<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOnline } from '@vueuse/core'
import { mdiAlertCircle, mdiCheckCircle, mdiCloseCircle, mdiCloudUploadOutline } from '@mdi/js'
import { progress, type AnswerState, type SavedQuiz } from '@/modules/quiz/domain/playState'

const props = defineProps<{ quiz: SavedQuiz; backTo: string; busy: boolean }>()
const emit = defineEmits<{ newQuiz: [] }>()

const { t } = useI18n()
const online = useOnline()
const totals = computed(() => progress(props.quiz))

const STATUS = {
  correct: { icon: mdiCheckCircle, color: 'success' },
  wrong: { icon: mdiCloseCircle, color: 'error' },
  pending: { icon: mdiCloudUploadOutline, color: 'info' },
  failed: { icon: mdiAlertCircle, color: 'warning' },
} as const

function statusOf(state: AnswerState | undefined): keyof typeof STATUS {
  if (state?.status === 'graded') {
    return state.result.correct ? 'correct' : 'wrong'
  }

  return state?.status === 'failed' ? 'failed' : 'pending'
}

const rows = computed(() =>
  props.quiz.attempt.questions.map((question) => {
    const state = props.quiz.answers[question.id]
    const textOf = (id: string | undefined) => question.options.find((option) => option.id === id)?.text ?? ''

    return {
      id: question.id,
      statement: question.statement,
      status: statusOf(state),
      chosen: textOf(state?.optionId),
      correct: state?.status === 'graded' ? textOf(state.result.correctOptionId) : null,
      explanation: state?.status === 'graded' ? state.result.explanation : null,
    }
  }),
)
</script>

<template>
  <v-card
    variant="flat"
    data-testid="quiz-results"
  >
    <v-card-title>{{ t('quiz.resultsTitle') }}</v-card-title>
    <v-card-text>
      <div
        class="text-h6"
        data-testid="quiz-score"
      >
        {{ t('quiz.score', { correct: totals.correct, total: totals.total }) }}
      </div>
      <v-alert
        v-if="totals.pending > 0"
        type="info"
        variant="tonal"
        class="mt-3"
        data-testid="quiz-results-pending"
        :text="t('quiz.resultsPending', totals.pending)"
      />

      <v-expansion-panels
        class="mt-4"
        variant="accordion"
      >
        <v-expansion-panel
          v-for="(row, index) in rows"
          :key="row.id"
          :data-testid="`quiz-result-${index}`"
        >
          <v-expansion-panel-title>
            <v-icon
              :icon="STATUS[row.status].icon"
              :color="STATUS[row.status].color"
              class="me-2"
            />
            <span class="me-2">{{ row.statement }}</span>
            <v-chip
              size="x-small"
              :color="STATUS[row.status].color"
            >
              {{ t(`quiz.status.${row.status}`) }}
            </v-chip>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <div>{{ t('quiz.yourAnswer', { answer: row.chosen }) }}</div>
            <div v-if="row.correct !== null">
              {{ t('quiz.correctAnswer', { answer: row.correct }) }}
            </div>
            <div
              v-if="row.explanation"
              class="mt-1"
            >
              <strong>{{ t('quiz.explanation') }}:</strong> {{ row.explanation }}
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </v-card-text>
    <v-card-actions class="flex-wrap">
      <v-btn
        :to="backTo"
        variant="text"
        data-testid="quiz-results-back"
      >
        {{ t('quiz.back') }}
      </v-btn>
      <v-spacer />
      <!-- A new quiz needs the server, and this one's answers must be in first. -->
      <v-btn
        color="primary"
        variant="flat"
        :loading="busy"
        :disabled="!online || totals.pending > 0"
        data-testid="quiz-new"
        @click="emit('newQuiz')"
      >
        {{ t('quiz.newQuiz') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
