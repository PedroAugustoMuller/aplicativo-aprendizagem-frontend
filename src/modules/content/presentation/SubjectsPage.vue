<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSubjectStore } from '@/modules/content/application/subjectStore'
import ApiErrorAlert from '@/shared/ui/ApiErrorAlert.vue'
import OfflineBanner from '@/shared/ui/OfflineBanner.vue'

const { t } = useI18n()
const store = useSubjectStore()

// Always refetch here: this page is where a newly enrolled subject should appear.
onMounted(() => void store.load())
</script>

<template>
  <div>
    <h1 class="text-h5 mb-4">
      {{ t('subjects.title') }}
    </h1>

    <OfflineBanner :saved-at="store.savedAt" />

    <v-progress-linear
      v-if="store.loading"
      indeterminate
      data-testid="subjects-loading"
    />

    <ApiErrorAlert
      v-else-if="store.error"
      :error="store.error"
      testid="subjects"
      @retry="store.load()"
    />

    <v-alert
      v-else-if="store.subjects.length === 0"
      type="info"
      variant="tonal"
      data-testid="subjects-empty"
      :text="t('subjects.empty')"
    />

    <!-- One column on phones, two on tablets, three on desktop. Same component. -->
    <v-row
      v-else
      data-testid="subjects-list"
    >
      <v-col
        v-for="subject in store.subjects"
        :key="subject.id"
        cols="12"
        sm="6"
        md="4"
      >
        <v-card
          :data-testid="`subject-${subject.id}`"
          :to="`/subjects/${subject.id}/topics`"
          class="h-100"
          variant="tonal"
        >
          <v-card-item>
            <v-card-title class="text-wrap">
              {{ subject.name }}
            </v-card-title>
            <template
              v-if="!subject.active"
              #append
            >
              <v-chip
                size="small"
                data-testid="subject-inactive"
              >
                {{ t('subjects.inactive') }}
              </v-chip>
            </template>
          </v-card-item>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>
