<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import TopicsPage from '@/modules/content/presentation/TopicsPage.vue'
import QuizTopicActions from '@/modules/quiz/presentation/QuizTopicActions.vue'

// Composition root: content lists the topics, quiz adds its actions to each card.
// Neither module imports the other.
const route = useRoute()
const subjectId = computed(() => (typeof route.params.subjectId === 'string' ? route.params.subjectId : ''))
</script>

<template>
  <TopicsPage>
    <template #topic-actions="{ topic }">
      <QuizTopicActions
        :topic-id="topic.id"
        :subject-id="subjectId"
        :topic-name="topic.name"
      />
    </template>
  </TopicsPage>
</template>
