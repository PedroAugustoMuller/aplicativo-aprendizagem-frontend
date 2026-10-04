<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { mdiArrowLeft } from '@mdi/js'
import { useTopicStore } from '@/modules/content/application/topicStore'
import { useClassroomStore } from '@/modules/identity/application/classroomStore'
import { useProgressStore } from '@/modules/quiz/application/progressStore'
import { sourceFromParams } from '@/modules/quiz/application/progressRoutes'
import TopicProgressPage from '@/modules/quiz/presentation/TopicProgressPage.vue'

// Composition root: quiz shows the progress, content names the topic, identity knows the
// classroom's subject. None of them imports another.
const { t } = useI18n()
const route = useRoute()
const topics = useTopicStore()
const classrooms = useClassroomStore()
const progress = useProgressStore()

const param = (name: string): string => {
  const value = route.params[name]

  return typeof value === 'string' ? value : ''
}

const source = computed(() => sourceFromParams(route.params))
const topicId = computed(() => param('topicId'))
const classroomId = computed(() => param('classroomId'))
const subjectId = computed(() => param('subjectId') || (classroomId.value === '' ? '' : (classrooms.find(classroomId.value)?.subjectId ?? '')))
const topicName = computed(() => topics.topics.find((topic) => topic.id === topicId.value)?.name ?? '')
const studentName = computed(() => {
  const s = source.value

  return s.kind === 'student' ? (progress.classroom.find((student) => student.id === s.studentId)?.name ?? '') : undefined
})
const backTo = computed(() => (classroomId.value === '' ? `/subjects/${subjectId.value}/topics` : `/classrooms/${classroomId.value}/progress`))

watch(classroomId, async (id) => {
  if (id === '') {
    return
  }

  if (classrooms.find(id) === null) {
    await classrooms.load()
  }

  if (!progress.classroom.some((student) => source.value.kind === 'student' && student.id === source.value.studentId)) {
    await progress.loadClassroom(id)
  }
}, { immediate: true })

watch(subjectId, (id) => {
  if (id !== '' && topics.subjectId !== id) {
    void topics.load(id)
  }
}, { immediate: true })
</script>

<template>
  <div>
    <v-btn
      :to="backTo"
      variant="text"
      :prepend-icon="mdiArrowLeft"
      class="mb-2 px-0"
      data-testid="progress-back"
    >
      {{ t('progress.back') }}
    </v-btn>
    <TopicProgressPage
      v-if="subjectId !== ''"
      :topic-id="topicId"
      :subject-id="subjectId"
      :topic-name="topicName"
      :source="source"
      :student-name="studentName"
    />
  </div>
</template>
