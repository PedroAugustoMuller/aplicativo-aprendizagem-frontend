<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import TopicsPage from '@/modules/content/presentation/TopicsPage.vue'
import QuizTopicActions from '@/modules/quiz/presentation/QuizTopicActions.vue'
import TopicTierBadge from '@/modules/quiz/presentation/TopicTierBadge.vue'
import { useProgressStore } from '@/modules/quiz/application/progressStore'
import { useQuizStore } from '@/modules/quiz/application/quizStore'
import { useViewerRole } from '@/shared/auth/viewer'

// Composition root: content lists the topics, quiz adds its tier and actions to each card.
// Neither module imports the other.
const route = useRoute()
const role = useViewerRole()
const progress = useProgressStore()
const quiz = useQuizStore()
const subjectId = computed(() => (typeof route.params.subjectId === 'string' ? route.params.subjectId : ''))

watch(subjectId, (id) => {
  if (role.value === 'student' && id !== '') {
    void progress.loadSubject(id)
  }
}, { immediate: true })

// The outbox just sent answers: the tiers on the cards are out of date.
watch(() => quiz.pendingCount, (now, before) => {
  if (role.value === 'student' && subjectId.value !== '' && now < before) {
    void progress.loadSubject(subjectId.value)
  }
})
</script>

<template>
  <TopicsPage>
    <template #topic-actions="{ topic }">
      <TopicTierBadge
        :topic-id="topic.id"
        :subject-id="subjectId"
      />
      <QuizTopicActions
        :topic-id="topic.id"
        :subject-id="subjectId"
        :topic-name="topic.name"
      />
    </template>
  </TopicsPage>
</template>
