<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTopicStore } from '@/modules/content/application/topicStore'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import TopicCard from '@/modules/content/presentation/TopicCard.vue'

const { t, te } = useI18n()
const store = useTopicStore()

const errorMessage = computed(() =>
  store.error === null ? null : apiErrorMessage(store.error, t, te),
)

onMounted(() => void store.load())
</script>

<template>
  <div>
    <h1 class="text-h5 mb-4">
      {{ t('topics.title') }}
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
          @click="store.load()"
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
