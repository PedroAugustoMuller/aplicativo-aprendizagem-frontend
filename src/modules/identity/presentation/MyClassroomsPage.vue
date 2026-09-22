<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useClassroomStore } from '@/modules/identity/application/classroomStore'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import SubjectLabel from '@/shared/ui/SubjectLabel.vue'

const { t, te } = useI18n()
const store = useClassroomStore()

const errorMessage = computed(() => (store.error === null ? null : apiErrorMessage(store.error, t, te)))

onMounted(() => void store.load())
</script>

<template>
  <div>
    <h1 class="text-h5 mb-4">
      {{ t('classrooms.mine') }}
    </h1>

    <v-progress-linear
      v-if="store.loading"
      indeterminate
      data-testid="my-classrooms-loading"
    />

    <v-alert
      v-else-if="errorMessage"
      type="error"
      variant="tonal"
      data-testid="my-classrooms-error"
      class="mb-4"
    >
      {{ errorMessage }}
      <template #append>
        <v-btn
          variant="text"
          data-testid="my-classrooms-retry"
          @click="store.load()"
        >
          {{ t('common.retry') }}
        </v-btn>
      </template>
    </v-alert>

    <v-alert
      v-else-if="store.classrooms.length === 0"
      type="info"
      variant="tonal"
      data-testid="my-classrooms-empty"
      :text="t('classrooms.emptyStudent')"
    />

    <!-- One column on phones, two on tablets, three on desktop. Same component. -->
    <v-row
      v-else
      data-testid="my-classrooms-list"
    >
      <v-col
        v-for="classroom in store.classrooms"
        :key="classroom.id"
        cols="12"
        sm="6"
        md="4"
      >
        <v-card
          :data-testid="`my-classroom-${classroom.id}`"
          class="h-100"
          variant="tonal"
        >
          <v-card-item>
            <v-card-title class="text-wrap">
              {{ classroom.name }}
            </v-card-title>
            <v-card-subtitle>
              <SubjectLabel :subject-id="classroom.subjectId" />
            </v-card-subtitle>
          </v-card-item>
          <v-card-actions>
            <v-btn
              color="primary"
              :to="`/subjects/${classroom.subjectId}/topics`"
            >
              {{ t('classrooms.openTopics') }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>
