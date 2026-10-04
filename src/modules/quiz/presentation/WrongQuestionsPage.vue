<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { mdiArrowLeft } from '@mdi/js'
import { useProgressStore } from '@/modules/quiz/application/progressStore'
import { sourceFromParams } from '@/modules/quiz/application/progressRoutes'
import { rowsFromWrong } from '@/modules/quiz/domain/answerRows'
import ApiErrorAlert from '@/shared/ui/ApiErrorAlert.vue'
import OfflineBanner from '@/shared/ui/OfflineBanner.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useProgressStore()
const source = computed(() => sourceFromParams(route.params))
const topicId = computed(() => (typeof route.params.topicId === 'string' ? route.params.topicId : ''))
const rows = computed(() => rowsFromWrong(store.wrong))
const chosenLabel = computed(() => (source.value.kind === 'own' ? 'progress.youAnswered' : 'progress.studentAnswered'))
const empty = computed(() => store.history !== null && store.wrong.length === 0)

const load = (): Promise<void> => store.loadTopic(source.value, topicId.value)

watch(topicId, load, { immediate: true })
</script>

<template>
  <div>
    <v-btn
      variant="text"
      :prepend-icon="mdiArrowLeft"
      class="mb-2 px-0"
      data-testid="wrong-back"
      @click="router.back()"
    >
      {{ t('progress.back') }}
    </v-btn>
    <h1 class="text-h5 mb-4">
      {{ t('progress.wrongTitle') }}
    </h1>
    <OfflineBanner :saved-at="store.savedAt" />
    <v-progress-linear
      v-if="store.loading && !store.history"
      indeterminate
    />
    <ApiErrorAlert
      v-else-if="store.error && !store.history"
      :error="store.error"
      testid="wrong"
      @retry="load"
    />
    <p
      v-else-if="empty"
      class="text-medium-emphasis"
      data-testid="wrong-empty"
    >
      {{ t('progress.wrongEmpty') }}
    </p>
    <v-card
      v-for="(row, index) in rows"
      :key="row.id"
      variant="outlined"
      class="mb-3"
      :data-testid="`wrong-question-${index}`"
    >
      <v-card-text>
        <div class="text-body-1 mb-2">
          {{ row.statement }}
        </div>
        <div class="text-error">
          {{ t(chosenLabel, { answer: row.chosen }) }}
        </div>
        <div class="text-success">
          {{ t('quiz.correctAnswer', { answer: row.correct ?? '' }) }}
        </div>
        <div
          v-if="row.explanation"
          class="mt-1"
        >
          <strong>{{ t('quiz.explanation') }}:</strong> {{ row.explanation }}
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>
