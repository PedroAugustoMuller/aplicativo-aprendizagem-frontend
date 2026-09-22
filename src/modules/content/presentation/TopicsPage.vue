<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useTopicStore } from '@/modules/content/application/topicStore'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { canRetry as canRetryError } from '@/shared/api/canRetry'
import SubjectLabel from '@/shared/ui/SubjectLabel.vue'
import TopicCard from '@/modules/content/presentation/TopicCard.vue'

const { t, te } = useI18n()
const route = useRoute()
const store = useTopicStore()

const subjectId = computed(() => (typeof route.params.subjectId === 'string' ? route.params.subjectId : null))

const errorMessage = computed(() =>
  store.error === null ? null : apiErrorMessage(store.error, t, te),
)

const canRetry = computed(() => canRetryError(store.error))

function load(): void {
  if (subjectId.value !== null) {
    void store.load(subjectId.value)
  }
}

onMounted(load)
watch(() => route.params.subjectId, load)
</script>

<template>
  <div>
    <h1 class="text-h5 mb-4">
      <SubjectLabel
        v-if="subjectId"
        :subject-id="subjectId"
        :fallback="t('topics.title')"
      />
      <template v-else>
        {{ t('topics.title') }}
      </template>
    </h1>

    <v-progress-linear
      v-if="store.loading"
      indeterminate
      data-testid="topics-loading"
    />

    <v-alert
      v-else-if="errorMessage"
      type="error"
      variant="tonal"
      data-testid="topics-error"
      class="mb-4"
    >
      {{ errorMessage }}
      <template
        v-if="canRetry"
        #append
      >
        <v-btn
          variant="text"
          data-testid="topics-retry"
          @click="load"
        >
          {{ t('common.retry') }}
        </v-btn>
      </template>
    </v-alert>

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
        v-for="topic in store.topics"
        :key="topic.id"
        cols="12"
        sm="6"
        md="4"
      >
        <TopicCard :topic="topic" />
      </v-col>
    </v-row>
  </div>
</template>
