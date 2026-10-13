<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { mdiArrowLeft } from '@mdi/js'
import { useClassroomStore } from '@/modules/identity/application/classroomStore'
import { useTopicStore } from '@/modules/content/application/topicStore'
import ClassroomProgressPanel from '@/modules/quiz/presentation/ClassroomProgressPanel.vue'

// Composition root: the URL carries the subject, identity names the classroom and the
// subject, content names the topics, quiz shows the grid. None of them imports another.
const { t } = useI18n()
const route = useRoute()
const classrooms = useClassroomStore()
const topics = useTopicStore()
const classroomId = computed(() => (typeof route.params.classroomId === 'string' ? route.params.classroomId : ''))
const subjectId = computed(() => (typeof route.params.subjectId === 'string' ? route.params.subjectId : ''))
const classroom = computed(() => (classroomId.value === '' ? null : classrooms.find(classroomId.value)))
const subjectName = computed(() => classrooms.subjectName(subjectId.value) ?? '')
// Like the students' topic list: deactivated topics are not part of the grid.
const columns = computed(() => topics.topics.filter((topic) => topic.active).map((topic) => ({ id: topic.id, name: topic.name })))

watch(classroomId, async (id) => {
  if (id !== '' && classrooms.find(id) === null) {
    await classrooms.load()
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
      :to="`/classrooms/${classroomId}`"
      variant="text"
      :prepend-icon="mdiArrowLeft"
      class="mb-2 px-0"
      data-testid="classroom-progress-back"
    >
      {{ t('progress.back') }}
    </v-btn>
    <ClassroomProgressPanel
      v-if="classroomId !== '' && subjectId !== ''"
      :classroom-id="classroomId"
      :subject-id="subjectId"
      :classroom-name="classroom?.name ?? ''"
      :subject-name="subjectName"
      :topics="columns"
    />
  </div>
</template>
