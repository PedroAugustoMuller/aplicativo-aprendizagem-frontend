<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { mdiArrowLeft } from '@mdi/js'
import { useClassroomStore } from '@/modules/identity/application/classroomStore'
import { useTopicStore } from '@/modules/content/application/topicStore'
import ClassroomProgressPanel from '@/modules/quiz/presentation/ClassroomProgressPanel.vue'

// Composition root: identity knows the classroom and its subject, content names the
// topics, quiz shows the grid. None of them imports another.
const { t } = useI18n()
const route = useRoute()
const classrooms = useClassroomStore()
const topics = useTopicStore()
const classroomId = computed(() => (typeof route.params.classroomId === 'string' ? route.params.classroomId : ''))
const classroom = computed(() => (classroomId.value === '' ? null : classrooms.find(classroomId.value)))
// Like the students' topic list: deactivated topics are not part of the grid.
const columns = computed(() => topics.topics.filter((topic) => topic.active).map((topic) => ({ id: topic.id, name: topic.name })))

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
      :to="`/classrooms/${classroomId}`"
      variant="text"
      :prepend-icon="mdiArrowLeft"
      class="mb-2 px-0"
      data-testid="classroom-progress-back"
    >
      {{ t('progress.back') }}
    </v-btn>
    <ClassroomProgressPanel
      v-if="classroomId !== ''"
      :classroom-id="classroomId"
      :classroom-name="classroom?.name ?? ''"
      :topics="columns"
    />
  </div>
</template>
