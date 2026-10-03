<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AnswerFeedback from '@/modules/quiz/presentation/AnswerFeedback.vue'
import type { QuizQuestion } from '@/modules/quiz/domain/Attempt'
import type { AnswerState } from '@/modules/quiz/domain/playState'

const props = defineProps<{
  question: QuizQuestion
  index: number
  total: number
  state: AnswerState | null
  /** This answer is on its way to the server right now. */
  sending: boolean
}>()
const emit = defineEmits<{ answer: [optionId: string]; next: [] }>()

const { t } = useI18n()
// Two steps on purpose: a slip of the finger selects, only Responder answers.
const selected = ref<string | null>(null)
const locked = computed(() => props.state !== null)
const chosen = computed(() => props.state?.optionId ?? selected.value)
const correctId = computed(() => (props.state?.status === 'graded' ? props.state.result.correctOptionId : null))
const last = computed(() => props.index + 1 === props.total)

function choose(optionId: string): void {
  if (!locked.value) {
    selected.value = optionId
  }
}

function submit(): void {
  if (!locked.value && selected.value !== null) {
    emit('answer', selected.value)
  }
}

function color(optionId: string): string | undefined {
  if (correctId.value === optionId) {
    return 'success'
  }

  if (props.state?.status === 'graded' && chosen.value === optionId) {
    return 'error'
  }

  return chosen.value === optionId ? 'primary' : undefined
}
</script>

<template>
  <v-card
    variant="flat"
    data-testid="quiz-question"
  >
    <v-card-item>
      <div
        class="text-caption text-medium-emphasis mb-1"
        data-testid="quiz-progress-label"
      >
        {{ t('quiz.progress', { current: index + 1, total }) }}
      </div>
      <v-progress-linear
        :model-value="((index + (locked ? 1 : 0)) / total) * 100"
        color="primary"
        rounded
        class="mb-3"
      />
      <v-card-title
        class="text-wrap px-0"
        data-testid="quiz-statement"
      >
        {{ question.statement }}
      </v-card-title>
    </v-card-item>

    <v-card-text>
      <div class="d-flex flex-column ga-2">
        <v-btn
          v-for="(option, position) in question.options"
          :key="option.id"
          block
          size="x-large"
          class="text-none text-wrap justify-start"
          :variant="chosen === option.id || correctId === option.id ? 'flat' : 'outlined'"
          :color="color(option.id)"
          :aria-pressed="chosen === option.id"
          :data-testid="`quiz-option-${position}`"
          @click="choose(option.id)"
        >
          {{ option.text }}
        </v-btn>
      </div>

      <AnswerFeedback
        v-if="state"
        class="mt-4"
        :question="question"
        :state="state"
        :sending="sending"
      />
    </v-card-text>

    <v-card-actions>
      <v-spacer />
      <v-btn
        v-if="!locked"
        color="primary"
        variant="flat"
        size="large"
        :disabled="selected === null || sending"
        data-testid="quiz-submit"
        @click="submit"
      >
        {{ t('quiz.submit') }}
      </v-btn>
      <v-btn
        v-else
        color="primary"
        variant="flat"
        size="large"
        :disabled="sending"
        data-testid="quiz-next"
        @click="emit('next')"
      >
        {{ last ? t('quiz.seeResults') : t('quiz.next') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
