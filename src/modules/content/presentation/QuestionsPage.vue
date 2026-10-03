<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useOnline } from '@vueuse/core'
import { mdiArrowLeft, mdiCancel, mdiPencil, mdiPlus, mdiRestore } from '@mdi/js'
import { useQuestionStore } from '@/modules/content/application/questionStore'
import { useTopicStore } from '@/modules/content/application/topicStore'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { ApiError } from '@/shared/api/error'
import type { Question } from '@/modules/content/domain/Question'
import ApiErrorAlert from '@/shared/ui/ApiErrorAlert.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import OfflineBanner from '@/shared/ui/OfflineBanner.vue'
import OfflineHint from '@/shared/ui/OfflineHint.vue'
import QuestionCard from '@/modules/content/presentation/QuestionCard.vue'

const { t, te } = useI18n()
const route = useRoute()
const store = useQuestionStore()
const topics = useTopicStore()
const online = useOnline()

const param = (name: string): string => {
  const value = route.params[name]

  return typeof value === 'string' ? value : ''
}
const subjectId = computed(() => param('subjectId'))
const topicId = computed(() => param('topicId'))
const basePath = computed(() => `/subjects/${subjectId.value}/topics/${topicId.value}/questions`)

const title = computed(() => topics.topics.find((topic) => topic.id === topicId.value)?.name ?? t('questions.fallbackTitle'))
const showInactive = ref(false)
const visible = computed(() => store.questions.filter((question) => showInactive.value || question.active))

const deactivating = ref<Question | null>(null)
const busy = ref(false)
const actionError = ref<ApiError | null>(null)
const actionMessage = computed(() => (actionError.value === null ? null : apiErrorMessage(actionError.value, t, te)))

async function run(action: () => Promise<void>): Promise<void> {
  if (busy.value) {
    return
  }

  busy.value = true
  actionError.value = null

  try {
    await action()
  } catch (failure: unknown) {
    actionError.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
  } finally {
    busy.value = false
  }
}

function toggle(question: Question): void {
  if (question.active) {
    deactivating.value = question
  } else {
    void run(() => store.setActive(question.id, true))
  }
}

async function confirmDeactivate(): Promise<void> {
  const question = deactivating.value

  if (question !== null) {
    await run(() => store.setActive(question.id, false))
    deactivating.value = null
  }
}

watch(
  [subjectId, topicId],
  ([subject, topic]) => {
    void store.load(topic)

    // The topic name comes from the subject's (cached) topic list.
    if (topics.subjectId !== subject || topics.topics.length === 0) {
      void topics.load(subject)
    }
  },
  { immediate: true },
)
</script>

<template>
  <div>
    <v-btn
      :to="`/subjects/${subjectId}/topics`"
      variant="text"
      :prepend-icon="mdiArrowLeft"
      data-testid="questions-back"
      class="mb-2 px-0"
    >
      {{ t('topics.fallbackTitle') }}
    </v-btn>

    <div class="d-flex align-center flex-wrap ga-2 mb-4">
      <h1
        class="text-h5 me-auto"
        data-testid="questions-title"
      >
        {{ title }}
      </h1>
      <v-btn
        color="primary"
        :prepend-icon="mdiPlus"
        :to="`${basePath}/new`"
        :disabled="!online"
        :title="online ? undefined : t('offline.writeDisabled')"
        data-testid="questions-create"
      >
        {{ t('questions.create') }}
      </v-btn>
    </div>

    <v-alert
      v-if="actionMessage"
      type="error"
      variant="tonal"
      closable
      class="mb-4"
      data-testid="questions-action-error"
      :text="actionMessage"
      @click:close="actionError = null"
    />

    <OfflineBanner :saved-at="store.savedAt" />
    <OfflineHint />

    <v-switch
      v-model="showInactive"
      color="primary"
      density="compact"
      hide-details
      class="mb-2"
      data-testid="questions-show-inactive"
      :label="t('questions.showInactive')"
    />

    <v-progress-linear
      v-if="store.loading"
      indeterminate
      data-testid="questions-loading"
    />

    <ApiErrorAlert
      v-else-if="store.error"
      :error="store.error"
      testid="questions"
      @retry="store.load(topicId)"
    />

    <v-alert
      v-else-if="visible.length === 0"
      type="info"
      variant="tonal"
      data-testid="questions-empty"
      :text="t('questions.empty')"
    />

    <v-row
      v-else
      data-testid="questions-list"
    >
      <v-col
        v-for="question in visible"
        :key="question.id"
        cols="12"
        md="6"
        :data-testid="`question-item-${question.id}`"
      >
        <QuestionCard :question="question" />
        <div class="d-flex flex-wrap ga-1 mt-1">
          <!-- Editing opens offline from the saved bank; only the form's Save needs a connection. -->
          <v-btn
            size="small"
            variant="text"
            :prepend-icon="mdiPencil"
            :to="`${basePath}/${question.id}/edit`"
            :data-testid="`question-edit-${question.id}`"
          >
            {{ t('questions.edit') }}
          </v-btn>
          <v-btn
            size="small"
            variant="text"
            :color="question.active ? 'error' : undefined"
            :prepend-icon="question.active ? mdiCancel : mdiRestore"
            :disabled="!online || busy"
            :data-testid="`question-toggle-${question.id}`"
            @click="toggle(question)"
          >
            {{ question.active ? t('questions.deactivate') : t('questions.reactivate') }}
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <ConfirmDialog
      :model-value="deactivating !== null"
      :title="t('questions.deactivateTitle')"
      :message="t('questions.deactivateMessage')"
      :confirm-label="t('questions.deactivate')"
      :busy="busy"
      testid="question-deactivate-dialog"
      @update:model-value="(open) => { if (!open) deactivating = null }"
      @confirm="confirmDeactivate"
    />
  </div>
</template>
