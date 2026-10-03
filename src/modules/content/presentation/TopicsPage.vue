<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useOnline } from '@vueuse/core'
import { mdiArrowLeft, mdiPlus } from '@mdi/js'
import { useSubjectStore } from '@/modules/content/application/subjectStore'
import { useTopicStore } from '@/modules/content/application/topicStore'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { ApiError } from '@/shared/api/error'
import type { Topic } from '@/modules/content/domain/Topic'
import ApiErrorAlert from '@/shared/ui/ApiErrorAlert.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import OfflineBanner from '@/shared/ui/OfflineBanner.vue'
import OfflineHint from '@/shared/ui/OfflineHint.vue'
import TopicCard from '@/modules/content/presentation/TopicCard.vue'
import TopicFormDialog from '@/modules/content/presentation/TopicFormDialog.vue'

const { t, te } = useI18n()
const route = useRoute()
const store = useTopicStore()
const subjects = useSubjectStore()
const online = useOnline()

const subjectId = computed(() => {
  const param = route.params.subjectId

  return typeof param === 'string' ? param : ''
})

// The subject list feeds the title and says whether this viewer authors the subject.
const title = computed(() => subjects.nameOf(subjectId.value) ?? t('topics.fallbackTitle'))
const canAuthor = computed(() => subjects.canAuthor(subjectId.value))

const formOpen = ref(false)
const editing = ref<Topic | null>(null)
const deactivating = ref<Topic | null>(null)
const busy = ref(false)
const actionError = ref<ApiError | null>(null)
const actionMessage = computed(() => (actionError.value === null ? null : apiErrorMessage(actionError.value, t, te)))
const locked = computed(() => !online.value || busy.value)

function openForm(topic: Topic | null): void {
  editing.value = topic
  formOpen.value = true
}

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

function toggle(topic: Topic): void {
  if (topic.active) {
    deactivating.value = topic
  } else {
    void run(() => store.setActive(topic.id, true))
  }
}

async function confirmDeactivate(): Promise<void> {
  const topic = deactivating.value

  if (topic !== null) {
    await run(() => store.setActive(topic.id, false))
    deactivating.value = null
  }
}

// Same component instance across /subjects/a/topics -> /subjects/b/topics: watch the param.
watch(
  subjectId,
  (id) => {
    void store.load(id)
    void subjects.ensureLoaded()
  },
  { immediate: true },
)
</script>

<template>
  <div>
    <v-btn
      to="/subjects"
      variant="text"
      :prepend-icon="mdiArrowLeft"
      data-testid="topics-back"
      class="mb-2 px-0"
    >
      {{ t('topics.back') }}
    </v-btn>

    <div class="d-flex align-center flex-wrap ga-2 mb-4">
      <h1
        class="text-h5 me-auto"
        data-testid="topics-title"
      >
        {{ title }}
      </h1>
      <v-btn
        v-if="canAuthor"
        color="primary"
        :prepend-icon="mdiPlus"
        :disabled="!online"
        :title="online ? undefined : t('offline.writeDisabled')"
        data-testid="topics-create"
        @click="openForm(null)"
      >
        {{ t('topics.create') }}
      </v-btn>
    </div>

    <v-alert
      v-if="actionMessage"
      type="error"
      variant="tonal"
      closable
      class="mb-4"
      data-testid="topics-action-error"
      :text="actionMessage"
      @click:close="actionError = null"
    />

    <OfflineBanner :saved-at="store.savedAt" />
    <OfflineHint v-if="canAuthor" />

    <v-progress-linear
      v-if="store.loading"
      indeterminate
      data-testid="topics-loading"
    />

    <ApiErrorAlert
      v-else-if="store.error"
      :error="store.error"
      testid="topics"
      @retry="store.load(subjectId)"
    />

    <v-alert
      v-else-if="store.topics.length === 0"
      type="info"
      variant="tonal"
      data-testid="topics-empty"
      :text="t('topics.empty')"
    />

    <!-- One column on phones, two on tablets, three on desktop. Same component. -->
    <v-row
      v-else
      data-testid="topics-list"
    >
      <v-col
        v-for="(topic, index) in store.topics"
        :key="topic.id"
        cols="12"
        sm="6"
        md="4"
      >
        <TopicCard
          :topic="topic"
          :subject-id="subjectId"
          :can-author="canAuthor"
          :first="index === 0"
          :last="index === store.topics.length - 1"
          :locked="locked"
          @edit="openForm(topic)"
          @toggle="toggle(topic)"
          @move="(direction) => run(() => store.move(topic.id, direction))"
        />
      </v-col>
    </v-row>

    <TopicFormDialog
      v-model="formOpen"
      :topic="editing"
    />
    <ConfirmDialog
      :model-value="deactivating !== null"
      :title="t('topics.deactivateTitle', { name: deactivating?.name ?? '' })"
      :message="t('topics.deactivateMessage')"
      :confirm-label="t('topics.deactivate')"
      :busy="busy"
      testid="topic-deactivate-dialog"
      @update:model-value="(open) => { if (!open) deactivating = null }"
      @confirm="confirmDeactivate"
    />
  </div>
</template>
