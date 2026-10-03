<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { useOnline } from '@vueuse/core'
import { mdiArrowLeft, mdiClose, mdiPlus } from '@mdi/js'
import { useQuestionStore } from '@/modules/content/application/questionStore'
import { useTopicStore } from '@/modules/content/application/topicStore'
import {
  blankForm,
  contentFromForm,
  copyForm,
  formFromQuestion,
  formProblems,
  sameForm,
  type FormProblem,
  type QuestionForm,
} from '@/modules/content/application/questionForm'
import { QUESTION_LIMITS as LIMITS } from '@/modules/content/domain/questionRules'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { ApiError } from '@/shared/api/error'
import type { Question } from '@/modules/content/domain/Question'
import ApiErrorAlert from '@/shared/ui/ApiErrorAlert.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import OfflineHint from '@/shared/ui/OfflineHint.vue'

const { t, te } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useQuestionStore()
const topics = useTopicStore()
const online = useOnline()

const param = (name: string): string => {
  const value = route.params[name]

  return typeof value === 'string' ? value : ''
}
const subjectId = computed(() => param('subjectId'))
const topicId = computed(() => param('topicId'))
const questionId = computed(() => param('questionId'))
const isEdit = computed(() => questionId.value !== '')
const bankPath = computed(() => `/subjects/${subjectId.value}/topics/${topicId.value}/questions`)
const topicName = computed(() => topics.topics.find((topic) => topic.id === topicId.value)?.name ?? t('questions.fallbackTitle'))

const newKey = (): string => globalThis.crypto.randomUUID()
// One id per visit to this page: a retry after a timeout replays the same create.
const requestId = globalThis.crypto.randomUUID()

const form = ref<QuestionForm>(blankForm('multiple_choice', newKey))
const pristine = ref<QuestionForm>(copyForm(form.value))
const loadedVersion = ref(0)
const ready = ref(!isEdit.value)

const original = computed(() => (isEdit.value ? store.find(questionId.value) : null))
const notFound = computed(
  () => isEdit.value && !ready.value && !store.loading && store.error === null && store.topicId === topicId.value && original.value === null,
)

function adopt(question: Question): void {
  form.value = formFromQuestion(question)
  pristine.value = copyForm(form.value)
  loadedVersion.value = question.version
  ready.value = true
}

watch(
  [subjectId, topicId],
  ([subject, topic]) => {
    // Reuse the bank already in memory (opened from the bank page, or saved offline).
    if (store.topicId !== topic || store.questions.length === 0) {
      void store.load(topic)
    }

    if (topics.subjectId !== subject || topics.topics.length === 0) {
      void topics.load(subject)
    }
  },
  { immediate: true },
)

// Only the first copy fills the form: a later reload must never overwrite what is being typed.
watch(
  original,
  (question) => {
    if (question !== null && !ready.value) {
      adopt(question)
    }
  },
  { immediate: true },
)

const dirty = computed(() => !sameForm(form.value, pristine.value))
const problems = computed(() => formProblems(form.value))
const showProblems = ref(false)

function problemText(problem: FormProblem): string {
  const max =
    problem === 'statement_too_long'
      ? LIMITS.statement
      : problem === 'explanation_too_long'
        ? LIMITS.explanation
        : problem === 'option_too_long'
          ? LIMITS.option
          : LIMITS.maxOptions

  return t(`questions.form.problems.${problem}`, { max, min: LIMITS.minOptions })
}

function addOption(): void {
  if (form.value.options.length < LIMITS.maxOptions) {
    form.value.options.push({ key: newKey(), id: null, text: '' })
  }
}

function removeOption(key: string): void {
  if (form.value.options.length > LIMITS.minOptions) {
    form.value.options = form.value.options.filter((option) => option.key !== key)

    if (form.value.correctKey === key) {
      form.value.correctKey = null
    }
  }
}

const busy = ref(false)
const error = ref<ApiError | null>(null)
const errorMessage = computed(() => (error.value === null ? null : apiErrorMessage(error.value, t, te)))
const editedElsewhere = computed(() => error.value?.code === 'content.question.edited_elsewhere')
let allowLeave = false

async function save(): Promise<void> {
  showProblems.value = true

  if (busy.value || !online.value || editedElsewhere.value || problems.value.length > 0) {
    return
  }

  busy.value = true
  error.value = null

  try {
    const content = contentFromForm(form.value)

    if (isEdit.value) {
      await store.update(questionId.value, loadedVersion.value, content)
    } else {
      await store.create(requestId, content)
    }

    allowLeave = true
    await router.push(bankPath.value)
  } catch (failure: unknown) {
    // The form is untouched: everything typed is still there for the retry.
    error.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
  } finally {
    busy.value = false
  }
}

async function reloadQuestion(): Promise<void> {
  await store.load(topicId.value)
  const question = store.find(questionId.value)

  if (question !== null) {
    error.value = null
    adopt(question)
  }
}

const leaving = ref(false)
let leaveTarget: string | null = null

onBeforeRouteLeave((to) => {
  if (allowLeave || !dirty.value) {
    return true
  }

  leaveTarget = to.fullPath
  leaving.value = true

  return false
})

function confirmLeave(): void {
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
      data-testid="question-form-back"
      class="mb-2 px-0"
    >
      {{ topicName }}
    </v-btn>

    <h1
      class="text-h5 mb-4"
      data-testid="question-form-title"
    >
      {{ isEdit ? t('questions.form.editTitle') : t('questions.form.createTitle') }}
    </h1>

    <OfflineHint />

    <v-progress-linear
      v-if="!ready && store.loading"
      indeterminate
      data-testid="question-form-loading"
    />

    <ApiErrorAlert
      v-else-if="!ready && store.error"
      :error="store.error"
      testid="question-form-load"
      @retry="store.load(topicId)"
    />

    <v-alert
      v-else-if="notFound"
      type="warning"
      variant="tonal"
      data-testid="question-form-missing"
      :text="t('errors.content.question_not_found')"
    />

    <v-form
      v-else-if="ready"
      data-testid="question-form"
      @submit.prevent="save"
    >
      <div
        v-if="!isEdit"
        class="mb-4"
      >
        <div class="text-subtitle-2 mb-1">
          {{ t('questions.form.type') }}
        </div>
        <v-btn-toggle
          v-model="form.type"
          mandatory
          divided
          color="primary"
          variant="outlined"
        >
          <v-btn
            value="multiple_choice"
            data-testid="question-form-type-multiple_choice"
          >
            {{ t('questions.form.types.multiple_choice') }}
          </v-btn>
          <v-btn
            value="true_false"
            data-testid="question-form-type-true_false"
          >
            {{ t('questions.form.types.true_false') }}
          </v-btn>
        </v-btn-toggle>
      </div>

      <v-textarea
        v-model="form.statement"
        data-testid="question-form-statement"
        :label="t('questions.form.statement')"
        :counter="LIMITS.statement"
        :maxlength="LIMITS.statement"
        rows="3"
        auto-grow
        autofocus
      />

      <template v-if="form.type === 'multiple_choice'">
        <div class="text-subtitle-2 mb-2">
          {{ t('questions.form.options') }}
        </div>
        <v-radio-group
          v-model="form.correctKey"
          hide-details
          class="mb-2"
        >
          <div
            v-for="(option, index) in form.options"
            :key="option.key"
            class="d-flex align-center ga-2 mb-2"
          >
            <v-radio
              :value="option.key"
              class="flex-grow-0"
              :aria-label="t('questions.form.markCorrect', { n: index + 1 })"
              :data-testid="`question-form-correct-${index}`"
            />
            <v-text-field
              v-model="option.text"
              density="compact"
              hide-details
              :label="t('questions.form.option', { n: index + 1 })"
              :maxlength="LIMITS.option"
              :data-testid="`question-form-option-text-${index}`"
            />
            <v-btn
              icon
              size="small"
              variant="text"
              :disabled="form.options.length <= LIMITS.minOptions"
              :aria-label="t('questions.form.removeOption', { n: index + 1 })"
              :title="t('questions.form.removeOption', { n: index + 1 })"
              :data-testid="`question-form-remove-${index}`"
              @click="removeOption(option.key)"
            >
              <v-icon :icon="mdiClose" />
            </v-btn>
          </div>
        </v-radio-group>
        <v-btn
          variant="text"
          class="mb-4"
          :prepend-icon="mdiPlus"
          :disabled="form.options.length >= LIMITS.maxOptions"
          data-testid="question-form-add-option"
          @click="addOption"
        >
          {{ t('questions.form.addOption') }}
        </v-btn>
      </template>

      <template v-else>
        <div class="text-subtitle-2 mb-1">
          {{ t('questions.form.answer') }}
        </div>
        <v-radio-group
          v-model="form.answer"
          inline
        >
          <v-radio
            :value="true"
            :label="t('questions.form.true')"
            data-testid="question-form-answer-true"
          />
          <v-radio
            :value="false"
            :label="t('questions.form.false')"
            data-testid="question-form-answer-false"
          />
        </v-radio-group>
      </template>

      <v-textarea
        v-model="form.explanation"
        class="mb-4"
        data-testid="question-form-explanation"
        :label="t('questions.form.explanation')"
        :hint="t('questions.form.explanationHint')"
        persistent-hint
        :counter="LIMITS.explanation"
        :maxlength="LIMITS.explanation"
        rows="2"
        auto-grow
      />

      <v-alert
        v-if="showProblems && problems.length > 0"
        type="warning"
        variant="tonal"
        class="mb-4"
        data-testid="question-form-problems"
      >
        <ul class="ps-4">
          <li
            v-for="problem in problems"
            :key="problem"
          >
            {{ problemText(problem) }}
          </li>
        </ul>
      </v-alert>

      <v-alert
        v-if="errorMessage"
        type="error"
        variant="tonal"
        class="mb-4"
        data-testid="question-form-error"
      >
        <div>{{ errorMessage }}</div>
        <v-btn
          v-if="editedElsewhere"
          class="mt-2"
          size="small"
          variant="outlined"
          data-testid="question-form-reload"
          @click="reloadQuestion"
        >
          {{ t('questions.form.reload') }}
        </v-btn>
      </v-alert>

      <div class="d-flex ga-2">
        <v-btn
          :to="bankPath"
          variant="text"
          data-testid="question-form-cancel"
        >
          {{ t('common.cancel') }}
        </v-btn>
        <v-spacer />
        <v-btn
          color="primary"
          variant="flat"
          data-testid="question-form-save"
          :loading="busy"
          :disabled="!online || busy || editedElsewhere"
          @click.prevent="save"
        >
          {{ error !== null && !editedElsewhere ? t('questions.form.retry') : t('common.save') }}
        </v-btn>
      </div>
    </v-form>

    <ConfirmDialog
      :model-value="leaving"
      :title="t('questions.form.leaveTitle')"
      :message="t('questions.form.leaveMessage')"
      :confirm-label="t('questions.form.leaveConfirm')"
      testid="question-form-leave"
      @update:model-value="(open) => { if (!open) leaving = false }"
      @confirm="confirmLeave"
    />
  </div>
</template>
