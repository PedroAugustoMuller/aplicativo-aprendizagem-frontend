<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { mdiArrowLeft } from '@mdi/js'
import { useSubjectStore } from '@/modules/content/application/subjectStore'
import { useTopicStore } from '@/modules/content/application/topicStore'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import TopicCard from '@/modules/content/presentation/TopicCard.vue'

const { t, te } = useI18n()
const route = useRoute()
const store = useTopicStore()
const subjects = useSubjectStore()

const subjectId = computed(() => {
  const param = route.params.subjectId

  return typeof param === 'string' ? param : ''
})

// The subject list only feeds the title; if it cannot load, the page still works.
const title = computed(() => subjects.nameOf(subjectId.value) ?? t('topics.fallbackTitle'))

const errorMessage = computed(() =>
  store.error === null ? null : apiErrorMessage(store.error, t, te),
)

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

    <h1
      class="text-h5 mb-4"
      data-testid="topics-title"
    >
      {{ title }}
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
      <template #append>
        <v-btn
          variant="text"
          data-testid="topics-retry"
          @click="store.load(subjectId)"
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
