<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { mdiArrowLeft } from '@mdi/js'
import { useClassroomStore } from '@/modules/identity/application/classroomStore'
import { useTopicStore } from '@/modules/content/application/topicStore'
import QuestionSummaryPage from '@/modules/quiz/presentation/QuestionSummaryPage.vue'
import { useViewerRole } from '@/shared/auth/viewer'

// Composition root: identity names the classroom and knows its subject, content names the
// topic, quiz shows the summary. None of them imports another.
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const role = useViewerRole()
const classrooms = useClassroomStore()
const topics = useTopicStore()

const param = (name: string): string => {
  const value = route.params[name]

  return typeof value === 'string' ? value : ''
}

const classroomId = computed(() => param('classroomId'))
const topicId = computed(() => param('topicId'))
const classroom = computed(() => (classroomId.value === '' ? null : classrooms.find(classroomId.value)))
const topicName = computed(() => topics.topics.find((topic) => topic.id === topicId.value)?.name ?? '')
// In the URL, so a reload or a shared link keeps the same view.
const scope = computed(() => (route.query.scope === 'all' ? 'all' : 'classroom'))

function changeScope(next: 'classroom' | 'all'): void {
  void router.replace({ query: next === 'all' ? { scope: 'all' } : {} })
}

watch(classroomId, async (id) => {
  if (id !== '' && classrooms.find(id) === null) {
    await classrooms.load()
  }
}, { immediate: true })

watch(() => classroom.value?.subjectId, (subjectId) => {
  if (subjectId !== undefined && topics.subjectId !== subjectId) {
    void topics.load(subjectId)
  }
}, { immediate: true })
</script>

<template>
  <div>
    <v-btn
      :to="`/classrooms/${classroomId}/progress`"
      variant="text"
      :prepend-icon="mdiArrowLeft"
      class="mb-2 px-0"
      data-testid="question-summary-back"
    >
      {{ t('progress.back') }}
    </v-btn>
    <QuestionSummaryPage
      v-if="classroomId !== '' && topicId !== ''"
      :classroom-id="classroomId"
      :classroom-name="classroom?.name ?? ''"
      :topic-id="topicId"
      :topic-name="topicName"
      :scope="scope"
      :admin="role === 'admin'"
      @update:scope="changeScope"
    />
  </div>
</template>
