<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'
import { useProgressStore } from '@/modules/quiz/application/progressStore'
import type { StudentProgress, StudentTopicTier } from '@/modules/quiz/domain/Progress'
import ApiErrorAlert from '@/shared/ui/ApiErrorAlert.vue'
import OfflineBanner from '@/shared/ui/OfflineBanner.vue'
import TierBadge from '@/modules/quiz/presentation/TierBadge.vue'

const props = defineProps<{ classroomId: string; classroomName: string; topics: readonly { id: string; name: string }[] }>()
const { t } = useI18n()
const { mdAndUp } = useDisplay()
const store = useProgressStore()

// A topic without answers has no entry: it is iron at 0.
const cellOf = (student: StudentProgress, topicId: string): StudentTopicTier =>
  student.topics.find((topic) => topic.topicId === topicId) ?? { topicId, points: 0, tier: 'iron' }
const linkOf = (studentId: string, topicId: string): string => `/classrooms/${props.classroomId}/students/${studentId}/topics/${topicId}/progress`
const empty = computed(() => !store.classroomLoading && store.classroomError === null && store.classroom.length === 0)

const load = (): Promise<void> => store.loadClassroom(props.classroomId)

watch(() => props.classroomId, load, { immediate: true })
</script>

<template>
  <div>
    <h1 class="text-h5">
      {{ t('progress.classroomTitle') }}
    </h1>
    <p class="text-medium-emphasis mb-4">
      {{ classroomName }}
    </p>
    <OfflineBanner :saved-at="store.classroomSavedAt" />
    <v-progress-linear
      v-if="store.classroomLoading && store.classroom.length === 0"
      indeterminate
    />
    <ApiErrorAlert
      v-else-if="store.classroomError && store.classroom.length === 0"
      :error="store.classroomError"
      testid="classroom-progress"
      @retry="load"
    />
    <p
      v-else-if="empty"
      class="text-medium-emphasis"
      data-testid="classroom-progress-empty"
    >
      {{ t('progress.noStudents') }}
    </p>

    <v-table
      v-else-if="mdAndUp"
      data-testid="classroom-progress-table"
    >
      <thead>
        <tr>
          <th>{{ t('progress.student') }}</th>
          <th
            v-for="topic in topics"
            :key="topic.id"
          >
            {{ topic.name }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="student in store.classroom"
          :key="student.id"
        >
          <td>{{ student.name }}</td>
          <td
            v-for="topic in topics"
            :key="topic.id"
          >
            <router-link
              :to="linkOf(student.id, topic.id)"
              class="text-decoration-none"
              :data-testid="`classroom-progress-cell-${student.id}-${topic.id}`"
            >
              <TierBadge
                :tier="cellOf(student, topic.id).tier"
                :points="cellOf(student, topic.id).points"
              />
            </router-link>
          </td>
        </tr>
      </tbody>
    </v-table>

    <div
      v-else
      data-testid="classroom-progress-list"
    >
      <v-card
        v-for="student in store.classroom"
        :key="student.id"
        variant="outlined"
        class="mb-3"
      >
        <v-card-title class="text-subtitle-1">
          {{ student.name }}
        </v-card-title>
        <v-card-text class="d-flex flex-column ga-2">
          <router-link
            v-for="topic in topics"
            :key="topic.id"
            :to="linkOf(student.id, topic.id)"
            class="d-flex justify-space-between align-center ga-2 text-decoration-none"
            :data-testid="`classroom-progress-cell-${student.id}-${topic.id}`"
          >
            <span class="text-body-2 text-high-emphasis">{{ topic.name }}</span>
            <TierBadge
              :tier="cellOf(student, topic.id).tier"
              :points="cellOf(student, topic.id).points"
            />
          </router-link>
        </v-card-text>
      </v-card>
    </div>
  </div>
</template>
