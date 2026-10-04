<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOnline } from '@vueuse/core'
import { progress, type SavedQuiz } from '@/modules/quiz/domain/playState'
import { rowsFromSavedQuiz } from '@/modules/quiz/domain/answerRows'
import type { Tier } from '@/modules/quiz/domain/Progress'
import AttemptAnswerList from '@/modules/quiz/presentation/AttemptAnswerList.vue'

const props = withDefaults(
  defineProps<{ quiz: SavedQuiz; backTo: string; busy: boolean; tierLine?: { tier: Tier; points: number } | null }>(),
  { tierLine: null },
)
const emit = defineEmits<{ newQuiz: [] }>()

const { t } = useI18n()
const online = useOnline()
const totals = computed(() => progress(props.quiz))

const rows = computed(() => rowsFromSavedQuiz(props.quiz))
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
      <div
        v-if="tierLine"
        class="text-subtitle-1 mt-1"
        data-testid="quiz-results-tier"
      >
        {{ t('progress.currentTier', { tier: t(`progress.tier.${tierLine.tier}`), points: tierLine.points }) }}
      </div>
      <v-alert
        v-if="totals.pending > 0"
        type="info"
        variant="tonal"
        class="mt-3"
        data-testid="quiz-results-pending"
        :text="t('quiz.resultsPending', totals.pending)"
      />

      <AttemptAnswerList :rows="rows" />
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
