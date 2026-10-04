<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { mdiAlertCircle, mdiCheckCircle, mdiCloseCircle, mdiCloudUploadOutline } from '@mdi/js'
import type { AnswerRow } from '@/modules/quiz/domain/answerRows'

withDefaults(defineProps<{ rows: readonly AnswerRow[]; chosenLabel?: string }>(), { chosenLabel: 'quiz.yourAnswer' })

const { t } = useI18n()

const STATUS = {
  correct: { icon: mdiCheckCircle, color: 'success' },
  wrong: { icon: mdiCloseCircle, color: 'error' },
  pending: { icon: mdiCloudUploadOutline, color: 'info' },
  failed: { icon: mdiAlertCircle, color: 'warning' },
} as const
</script>

<template>
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
        <div>{{ t(chosenLabel, { answer: row.chosen }) }}</div>
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
</template>
