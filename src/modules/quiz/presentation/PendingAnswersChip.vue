<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { mdiCloudUploadOutline } from '@mdi/js'
import { useQuizStore } from '@/modules/quiz/application/quizStore'

const { t } = useI18n()
const store = useQuizStore()
</script>

<template>
  <!-- Proof for the student that nothing was lost while offline. -->
  <v-chip
    v-if="store.pendingCount > 0"
    size="small"
    color="warning"
    variant="tonal"
    class="me-2"
    :prepend-icon="mdiCloudUploadOutline"
    data-testid="quiz-pending-chip"
  >
    {{ t('quiz.pendingChip', store.pendingCount) }}
  </v-chip>
</template>
