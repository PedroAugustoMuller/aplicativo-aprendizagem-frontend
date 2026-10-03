<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useOnline } from '@vueuse/core'
import { mdiCloudCheck, mdiCloudDownload, mdiPlay } from '@mdi/js'
import { useQuizStore } from '@/modules/quiz/application/quizStore'
import { useViewerRole } from '@/shared/auth/viewer'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { ApiError } from '@/shared/api/error'

const props = defineProps<{ topicId: string; subjectId: string; topicName: string }>()

const { t, te } = useI18n()
const router = useRouter()
const store = useQuizStore()
const role = useViewerRole()
const online = useOnline()
const busy = ref(false)
const failure = ref<ApiError | null>(null)
const message = computed(() => (failure.value === null ? null : apiErrorMessage(failure.value, t, te)))
const open = computed(() => store.openByTopic[props.topicId] ?? null)
const context = computed(() => ({ topicName: props.topicName, subjectId: props.subjectId }))

async function run(work: () => Promise<void>): Promise<void> {
  if (busy.value) {
    return
  }

  busy.value = true
  failure.value = null

  try {
    await work()
  } catch (caught: unknown) {
    failure.value = caught instanceof ApiError ? caught : new ApiError('system.unexpected_error')
  } finally {
    busy.value = false
  }
}

const start = () => run(async () => {
  await router.push(`/quiz/${await store.prepare(props.topicId, context.value)}`)
})
const download = () => run(async () => {
  await store.prepare(props.topicId, context.value)
})

function resume(): void {
  if (open.value !== null) {
    void router.push(`/quiz/${open.value.attemptId}`)
  }
}

onMounted(() => {
  if (role.value === 'student') {
    void store.refreshTopic(props.topicId)
  }
})
</script>

<template>
  <div
    v-if="role === 'student'"
    class="d-flex flex-wrap align-center ga-1 mt-1"
  >
    <template v-if="open">
      <v-btn
        color="primary"
        size="small"
        :prepend-icon="mdiPlay"
        :data-testid="`quiz-continue-${topicId}`"
        @click="resume"
      >
        {{ t('quiz.continue', { answered: open.answered, total: open.total }) }}
      </v-btn>
      <v-chip
        size="small"
        :prepend-icon="mdiCloudCheck"
        :data-testid="`quiz-downloaded-${topicId}`"
      >
        {{ t('quiz.downloaded') }}
      </v-chip>
    </template>
    <template v-else>
      <v-btn
        color="primary"
        size="small"
        :prepend-icon="mdiPlay"
        :loading="busy"
        :disabled="!online"
        :data-testid="`quiz-start-${topicId}`"
        @click="start"
      >
        {{ t('quiz.start') }}
      </v-btn>
      <v-btn
        icon
        size="small"
        variant="text"
        :disabled="!online || busy"
        :aria-label="t('quiz.download')"
        :title="t('quiz.download')"
        :data-testid="`quiz-download-${topicId}`"
        @click="download"
      >
        <v-icon :icon="mdiCloudDownload" />
      </v-btn>
      <!-- Visible text, not a tooltip: a phone never shows a title attribute. -->
      <div
        v-if="!online"
        class="text-caption text-medium-emphasis w-100"
        :data-testid="`quiz-offline-${topicId}`"
      >
        {{ t('quiz.offlineNoDownload') }}
      </div>
    </template>
    <v-alert
      v-if="message"
      type="error"
      variant="tonal"
      density="compact"
      class="w-100"
      :data-testid="`quiz-actions-error-${topicId}`"
      :text="message"
    />
  </div>
</template>
