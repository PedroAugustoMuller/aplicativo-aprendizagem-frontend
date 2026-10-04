<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { mdiArrowLeft } from '@mdi/js'
import { useProgressStore } from '@/modules/quiz/application/progressStore'
import { sourceFromParams } from '@/modules/quiz/application/progressRoutes'
import { rowsFromAttempt } from '@/modules/quiz/domain/answerRows'
import ApiErrorAlert from '@/shared/ui/ApiErrorAlert.vue'
import OfflineBanner from '@/shared/ui/OfflineBanner.vue'
import AttemptAnswerList from '@/modules/quiz/presentation/AttemptAnswerList.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useProgressStore()
const source = computed(() => sourceFromParams(route.params))
const attemptId = computed(() => (typeof route.params.attemptId === 'string' ? route.params.attemptId : ''))
const rows = computed(() => (store.reviewed === null ? [] : rowsFromAttempt(store.reviewed)))
const chosenLabel = computed(() => (source.value.kind === 'own' ? 'quiz.yourAnswer' : 'progress.studentAnswered'))

const load = (): Promise<void> => store.loadAttempt(source.value, attemptId.value)

watch(attemptId, load, { immediate: true })
</script>

<template>
  <div>
    <v-btn
      variant="text"
      :prepend-icon="mdiArrowLeft"
      class="mb-2 px-0"
      data-testid="review-back"
      @click="router.back()"
    >
      {{ t('progress.back') }}
    </v-btn>
    <h1 class="text-h5 mb-4">
      {{ t('progress.reviewTitle') }}
    </h1>
    <OfflineBanner :saved-at="store.reviewSavedAt" />
    <v-progress-linear
      v-if="store.reviewLoading && !store.reviewed"
      indeterminate
    />
    <ApiErrorAlert
      v-else-if="store.reviewError && !store.reviewed"
      :error="store.reviewError"
      testid="review"
      @retry="load"
    />
    <AttemptAnswerList
      v-else
      :rows="rows"
      :chosen-label="chosenLabel"
    />
  </div>
</template>
