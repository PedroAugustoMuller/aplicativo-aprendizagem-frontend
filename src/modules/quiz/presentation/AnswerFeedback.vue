<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { mdiAlertCircle, mdiCheckCircle, mdiCloseCircle, mdiCloudUploadOutline } from '@mdi/js'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { ApiError } from '@/shared/api/error'
import type { QuizQuestion } from '@/modules/quiz/domain/Attempt'
import type { AnswerState } from '@/modules/quiz/domain/playState'

const props = defineProps<{ question: QuizQuestion; state: AnswerState; sending: boolean }>()
const { t, te } = useI18n()

const result = computed(() => (props.state.status === 'graded' ? props.state.result : null))
const correctText = computed(() =>
  props.question.options.find((option) => option.id === result.value?.correctOptionId)?.text ?? '',
)
const failure = computed(() =>
  props.state.status === 'failed' ? apiErrorMessage(new ApiError(props.state.errorCode), t, te) : '',
)
</script>

<template>
  <!-- Always an icon and words, never colour alone (RNF06). -->
  <v-alert
    v-if="state.status === 'pending' && sending"
    type="info"
    variant="tonal"
    :icon="mdiCloudUploadOutline"
    data-testid="quiz-feedback-sending"
    :text="t('quiz.sending')"
  />
  <v-alert
    v-else-if="state.status === 'pending'"
    type="info"
    variant="tonal"
    :icon="mdiCloudUploadOutline"
    data-testid="quiz-feedback-pending"
    :text="t('quiz.pending')"
  />
  <v-alert
    v-else-if="state.status === 'failed'"
    type="warning"
    variant="tonal"
    :icon="mdiAlertCircle"
    data-testid="quiz-feedback-failed"
    :text="t('quiz.failed', { reason: failure })"
  />
  <v-alert
    v-else-if="result"
    :type="result.correct ? 'success' : 'error'"
    variant="tonal"
    :icon="result.correct ? mdiCheckCircle : mdiCloseCircle"
    :data-testid="result.correct ? 'quiz-feedback-correct' : 'quiz-feedback-wrong'"
    :title="result.correct ? t('quiz.correct') : t('quiz.wrong', { answer: correctText })"
  >
    <div
      v-if="result.explanation"
      class="mt-1"
      data-testid="quiz-explanation"
    >
      <strong>{{ t('quiz.explanation') }}:</strong> {{ result.explanation }}
    </div>
  </v-alert>
</template>
