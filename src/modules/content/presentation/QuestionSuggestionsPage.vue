<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { useOnline } from '@vueuse/core'
import { mdiArrowLeft, mdiCheck, mdiClose, mdiPaperclip, mdiPencil } from '@mdi/js'
import { useQuestionStore } from '@/modules/content/application/questionStore'
import { useTopicStore } from '@/modules/content/application/topicStore'
import { asPreview, useQuestionSuggestionStore } from '@/modules/content/application/questionSuggestionStore'
import { SUGGESTION_LIMITS as LIMITS, type SuggestionRequest } from '@/modules/content/domain/QuestionSuggestion'
import { useSourceFileInput } from '@/modules/content/presentation/useSourceFileInput'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { ApiError } from '@/shared/api/error'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import OfflineHint from '@/shared/ui/OfflineHint.vue'
import QuestionCard from '@/modules/content/presentation/QuestionCard.vue'

const { t, te } = useI18n()
const route = useRoute()
const router = useRouter()
const questions = useQuestionStore()
const topics = useTopicStore()
const store = useQuestionSuggestionStore()
const online = useOnline()

const param = (name: string): string => {
  const value = route.params[name]

  return typeof value === 'string' ? value : ''
}
const subjectId = computed(() => param('subjectId'))
const topicId = computed(() => param('topicId'))
const bankPath = computed(() => `/subjects/${subjectId.value}/topics/${topicId.value}/questions`)
const topicName = computed(() => topics.topics.find((topic) => topic.id === topicId.value)?.name ?? t('questions.fallbackTitle'))

const request = ref<SuggestionRequest>(store.draft(topicId.value))
watch(request, (value) => store.saveDraft(topicId.value, value), { deep: true })

watch(
  [subjectId, topicId],
  ([subject, topic]) => {
    if (questions.topicId !== topic) {
      void questions.load(topic)
    }

    if (topics.subjectId !== subject || topics.topics.length === 0) {
      void topics.load(subject)
    }
  },
  { immediate: true },
)

const suggestions = computed(() => store.list(topicId.value))
const tooLong = computed(() => request.value.sourceText.length > LIMITS.sourceText)
const noType = computed(() => request.value.types.length === 0)
const canGenerate = computed(() => online.value && !busy.value && !tooLong.value && !noType.value)

const busy = ref(false)
const error = ref<ApiError | null>(null)
const errorMessage = computed(() => {
  if (error.value === null) {
    return null
  }

  if (error.value.code === 'http.too_many_requests') {
    const seconds = Number(error.value.params.retry_after ?? 60)

    return t('questions.suggestions.rateLimited', { minutes: Math.max(1, Math.ceil(seconds / 60)) })
  }

  return apiErrorMessage(error.value, t, te)
})

async function run(action: () => Promise<void>): Promise<void> {
  if (busy.value) {
    return
  }

  busy.value = true
  error.value = null

  try {
    await action()
  } catch (failure: unknown) {
    // The request form is untouched: "Gerar" again resends exactly the same.
    error.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
  } finally {
    busy.value = false
  }
}

const generate = (): Promise<void> => (canGenerate.value ? run(() => store.generate(topicId.value, request.value)) : Promise.resolve())
const accept = (key: string): Promise<void> => run(() => store.accept(topicId.value, key))
const acceptAll = (): Promise<void> => run(() => store.acceptAll(topicId.value))
const editPath = (key: string): string => `${bankPath.value}/new?suggestion=${encodeURIComponent(key)}`

const { fileInput, reading, truncated, fileProblem, attach } = useSourceFileInput((text) => {
  request.value.sourceText = text
})

const leaving = ref(false)
let leaveTarget: string | null = null
let allowLeave = false

onBeforeRouteLeave((to) => {
  const editing = to.path === `${bankPath.value}/new` && typeof to.query.suggestion === 'string'

  if (allowLeave || editing || suggestions.value.length === 0) {
    return true
  }

  leaveTarget = to.fullPath
  leaving.value = true

  return false
})

function confirmLeave(): void {
  store.byTopic = { ...store.byTopic, [topicId.value]: [] }
  allowLeave = true
  leaving.value = false

  if (leaveTarget !== null) {
    void router.push(leaveTarget)
  }
}
</script>

<template>
  <div>
    <v-btn
      :to="bankPath"
      variant="text"
      :prepend-icon="mdiArrowLeft"
      data-testid="suggestions-back"
      class="mb-2 px-0"
    >
      {{ topicName }}
    </v-btn>

    <h1
      class="text-h5 mb-1"
      data-testid="suggestions-title"
    >
      {{ t('questions.suggestions.title') }}
    </h1>
    <p class="text-body-2 text-medium-emphasis mb-4">
      {{ t('questions.suggestions.intro') }}
    </p>

    <OfflineHint />

    <v-form
      data-testid="suggestions-form"
      @submit.prevent="generate"
    >
      <v-row dense>
        <v-col
          cols="12"
          sm="4"
        >
          <v-select
            v-model="request.count"
            :items="Array.from({ length: LIMITS.maxCount }, (_, i) => i + 1)"
            :label="t('questions.suggestions.count')"
            data-testid="suggestions-count"
          />
        </v-col>
        <v-col
          cols="12"
          sm="4"
        >
          <v-select
            v-model="request.difficulty"
            :items="(['easy', 'medium', 'hard'] as const).map((value) => ({ value, title: t(`questions.suggestions.difficulties.${value}`) }))"
            :label="t('questions.suggestions.difficulty')"
            data-testid="suggestions-difficulty"
          />
        </v-col>
        <v-col
          cols="12"
          sm="4"
        >
          <div class="text-subtitle-2">
            {{ t('questions.suggestions.types') }}
          </div>
          <v-checkbox
            v-for="type in (['multiple_choice', 'true_false'] as const)"
            :key="type"
            v-model="request.types"
            :value="type"
            :label="t(`questions.form.types.${type}`)"
            density="compact"
            hide-details
            :data-testid="`suggestions-type-${type}`"
          />
          <div
            v-if="noType"
            class="text-error text-caption"
          >
            {{ t('questions.suggestions.typesRequired') }}
          </div>
        </v-col>
      </v-row>

      <v-textarea
        v-model="request.notes"
        :label="t('questions.suggestions.notes')"
        :hint="t('questions.suggestions.notesHint')"
        persistent-hint
        :counter="LIMITS.notes"
        :maxlength="LIMITS.notes"
        rows="1"
        auto-grow
        class="mb-2"
        data-testid="suggestions-notes"
      />

      <v-textarea
        v-model="request.sourceText"
        :label="t('questions.suggestions.sourceText')"
        :hint="t('questions.suggestions.sourceHint')"
        persistent-hint
        :counter="LIMITS.sourceText"
        rows="4"
        auto-grow
        class="mb-2"
        data-testid="suggestions-source"
      />
      <input
        ref="fileInput"
        type="file"
        accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        class="d-none"
        data-testid="suggestions-file"
        @change="attach"
      >
      <v-btn
        variant="text"
        :prepend-icon="mdiPaperclip"
        :loading="reading"
        class="mb-2 px-0"
        data-testid="suggestions-attach"
        @click="fileInput?.click()"
      >
        {{ t('questions.suggestions.attach') }}
      </v-btn>
      <v-alert
        v-if="truncated"
        type="info"
        variant="tonal"
        class="mb-2"
        data-testid="suggestions-truncated"
        :text="t('questions.suggestions.truncated', { max: LIMITS.sourceText.toLocaleString() })"
      />
      <v-alert
        v-if="fileProblem"
        type="warning"
        variant="tonal"
        class="mb-2"
        data-testid="suggestions-file-error"
        :text="t(`questions.suggestions.file.${fileProblem}`)"
      />

      <v-alert
        v-if="tooLong"
        type="warning"
        variant="tonal"
        class="mb-2"
        data-testid="suggestions-too-long"
        :text="t('questions.suggestions.tooLong', { max: LIMITS.sourceText.toLocaleString() })"
      />

      <v-alert
        v-if="errorMessage"
        type="error"
        variant="tonal"
        class="mb-2"
        data-testid="suggestions-error"
        :text="errorMessage"
      />

      <div class="d-flex align-center ga-2 mb-6">
        <v-btn
          color="primary"
          variant="flat"
          :loading="busy"
          :disabled="!canGenerate"
          data-testid="suggestions-generate"
          @click.prevent="generate"
        >
          {{ suggestions.length > 0 ? t('questions.suggestions.generateMore') : t('questions.suggestions.generate') }}
        </v-btn>
        <span
          v-if="busy"
          class="text-caption"
        >{{ t('questions.suggestions.generating') }}</span>
      </div>
    </v-form>

    <div class="d-flex align-center mb-2">
      <h2 class="text-h6 me-auto">
        {{ t('questions.suggestions.listTitle', { n: suggestions.length }) }}
      </h2>
      <v-btn
        v-if="suggestions.length > 1"
        variant="tonal"
        color="primary"
        :disabled="!online || busy"
        data-testid="suggestions-accept-all"
        @click="acceptAll"
      >
        {{ t('questions.suggestions.acceptAll') }}
      </v-btn>
    </div>

    <v-alert
      v-if="suggestions.length === 0"
      type="info"
      variant="tonal"
      data-testid="suggestions-empty"
      :text="t('questions.suggestions.empty')"
    />

    <v-row v-else>
      <v-col
        v-for="suggestion in suggestions"
        :key="suggestion.key"
        cols="12"
        md="6"
        :data-testid="`suggestion-item-${suggestion.key}`"
      >
        <QuestionCard :question="asPreview(suggestion, topicId)" />
        <div class="d-flex flex-wrap ga-1 mt-1">
          <v-btn
            size="small"
            variant="text"
            color="primary"
            :prepend-icon="mdiCheck"
            :disabled="!online || busy"
            :data-testid="`suggestion-accept-${suggestion.key}`"
            @click="accept(suggestion.key)"
          >
            {{ t('questions.suggestions.accept') }}
          </v-btn>
          <v-btn
            size="small"
            variant="text"
            :prepend-icon="mdiPencil"
            :to="editPath(suggestion.key)"
            :data-testid="`suggestion-edit-${suggestion.key}`"
          >
            {{ t('questions.suggestions.edit') }}
          </v-btn>
          <v-btn
            size="small"
            variant="text"
            color="error"
            :prepend-icon="mdiClose"
            :disabled="busy"
            :data-testid="`suggestion-discard-${suggestion.key}`"
            @click="store.discard(topicId, suggestion.key)"
          >
            {{ t('questions.suggestions.discard') }}
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <ConfirmDialog
      :model-value="leaving"
      :title="t('questions.suggestions.leaveTitle')"
      :message="t('questions.suggestions.leaveMessage')"
      :confirm-label="t('questions.suggestions.leaveConfirm')"
      testid="suggestions-leave"
      @update:model-value="(open) => { if (!open) leaving = false }"
      @confirm="confirmLeave"
    />
  </div>
</template>
