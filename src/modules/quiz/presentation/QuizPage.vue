<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { mdiArrowLeft } from '@mdi/js'
import { useQuizStore } from '@/modules/quiz/application/quizStore'
import { firstUnanswered } from '@/modules/quiz/domain/playState'
import { ApiError } from '@/shared/api/error'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import ApiErrorAlert from '@/shared/ui/ApiErrorAlert.vue'
import QuizQuestionCard from '@/modules/quiz/presentation/QuizQuestionCard.vue'
import QuizResults from '@/modules/quiz/presentation/QuizResults.vue'

const { t, te } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useQuizStore()

const attemptId = computed(() => (typeof route.params.attemptId === 'string' ? route.params.attemptId : ''))
// The question on screen. Feedback stays up until Próxima, so this is not derived.
const index = ref(0)
const quiz = computed(() => store.quiz)
const total = computed(() => quiz.value?.attempt.questions.length ?? 0)
const current = computed(() => quiz.value?.attempt.questions[index.value] ?? null)
const backTo = computed(() => (quiz.value && quiz.value.subjectId !== '' ? `/subjects/${quiz.value.subjectId}/topics` : '/subjects'))
const starting = ref(false)
const startError = ref<ApiError | null>(null)
const startMessage = computed(() => (startError.value === null ? null : apiErrorMessage(startError.value, t, te)))

function answerCurrent(optionId: string): void {
  if (current.value !== null) {
    void store.answer(current.value.id, optionId)
  }
}

async function startNew(): Promise<void> {
  const saved = quiz.value

  if (saved === null || starting.value) {
    return
  }

  starting.value = true
  startError.value = null

  try {
    const id = await store.prepare(saved.attempt.topicId, { topicName: saved.topicName, subjectId: saved.subjectId })
    await router.push(`/quiz/${id}`)
  } catch (failure: unknown) {
    startError.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
  } finally {
    starting.value = false
  }
}

// Same instance across /quiz/a -> /quiz/b (Novo quiz): watch the param.
watch(
  attemptId,
  async (id) => {
    await store.open(id)
    index.value = store.quiz === null ? 0 : firstUnanswered(store.quiz)
    // Opening a quiz is a moment to send what an earlier visit left queued.
    void store.sync()
  },
  { immediate: true },
)
</script>

<template>
  <div>
    <v-btn
      :to="backTo"
      variant="text"
      :prepend-icon="mdiArrowLeft"
      class="mb-2 px-0"
      data-testid="quiz-back"
    >
      {{ t('quiz.back') }}
    </v-btn>

    <h1
      v-if="quiz && quiz.topicName !== ''"
      class="text-h5 mb-4"
      data-testid="quiz-title"
    >
      {{ quiz.topicName }}
    </h1>

    <v-progress-linear
      v-if="store.loading && !quiz"
      indeterminate
      data-testid="quiz-loading"
    />

    <ApiErrorAlert
      v-else-if="store.error && !quiz"
      :error="store.error"
      testid="quiz"
      @retry="store.open(attemptId)"
    />

    <template v-else-if="quiz">
      <QuizQuestionCard
        v-if="current"
        :key="current.id"
        :question="current"
        :index="index"
        :total="total"
        :state="quiz.answers[current.id] ?? null"
        :sending="store.sendingQuestion === current.id"
        @answer="answerCurrent"
        @next="index += 1"
      />
      <template v-else>
        <v-alert
          v-if="startMessage"
          type="error"
          variant="tonal"
          class="mb-4"
          data-testid="quiz-new-error"
          :text="startMessage"
        />
        <QuizResults
          :quiz="quiz"
          :back-to="backTo"
          :busy="starting"
          @new-quiz="startNew"
        />
      </template>
    </template>
  </div>
</template>
