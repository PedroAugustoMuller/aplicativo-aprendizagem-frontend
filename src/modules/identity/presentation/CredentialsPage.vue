<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { mdiArrowLeft, mdiPrinter } from '@mdi/js'
import { useClassroomStore } from '@/modules/identity/application/classroomStore'
import { useRosterStore } from '@/modules/identity/application/rosterStore'
import ApiErrorAlert from '@/shared/ui/ApiErrorAlert.vue'

const { t } = useI18n()
const route = useRoute()
const classrooms = useClassroomStore()
const roster = useRosterStore()

const classroomId = computed(() => {
  const param = route.params.classroomId

  return typeof param === 'string' ? param : ''
})
const title = computed(() => {
  const name = classrooms.find(classroomId.value)?.name

  return name === undefined ? t('credentials.fallbackTitle') : t('credentials.title', { name })
})
// Printed on each slip so a student knows where to sign in.
const address = globalThis.location.origin
const print = (): void => globalThis.print()

onMounted(() => void classrooms.ensureLoaded())
watch(classroomId, (id) => void roster.loadCredentials(id), { immediate: true })
</script>

<template>
  <div>
    <div class="no-print">
      <v-btn
        :to="`/classrooms/${classroomId}`"
        variant="text"
        :prepend-icon="mdiArrowLeft"
        class="mb-2 px-0"
        data-testid="credentials-back"
      >
        {{ t('credentials.back') }}
      </v-btn>

      <div class="d-flex align-center flex-wrap ga-2 mb-4">
        <h1
          class="text-h5 me-auto"
          data-testid="credentials-title"
        >
          {{ title }}
        </h1>
        <v-btn
          color="primary"
          :prepend-icon="mdiPrinter"
          :disabled="roster.credentials.length === 0"
          data-testid="credentials-print"
          @click="print"
        >
          {{ t('credentials.print') }}
        </v-btn>
      </div>
    </div>

    <v-progress-linear
      v-if="roster.credentialsLoading"
      indeterminate
    />

    <ApiErrorAlert
      v-else-if="roster.credentialsError"
      :error="roster.credentialsError"
      testid="credentials"
      @retry="roster.loadCredentials(classroomId)"
    />

    <v-alert
      v-else-if="roster.credentials.length === 0"
      type="info"
      variant="tonal"
      data-testid="credentials-empty"
      :text="t('credentials.empty')"
    />

    <div
      v-else
      class="print-area credential-grid"
      data-testid="credentials-grid"
    >
      <div
        v-for="credential in roster.credentials"
        :key="credential.userId"
        class="credential-card"
        :data-testid="`credential-${credential.userId}`"
      >
        <p class="text-subtitle-2">
          {{ t('app.name') }} — {{ address }}
        </p>
        <p class="text-h6 my-1">
          {{ credential.name }}
        </p>
        <p>{{ t('accounts.login') }}: <strong>{{ credential.username }}</strong></p>
        <p>
          {{ t('accounts.temporaryPassword') }}:
          <strong class="font-monospace">{{ credential.temporaryPassword }}</strong>
        </p>
        <p class="text-caption mt-1">
          {{ t('accounts.changeOnFirstLogin') }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.credential-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: 1rem;
}

.credential-card {
  border: 1px dashed currentcolor;
  border-radius: 8px;
  padding: 1rem;
  break-inside: avoid;
}

/* Two columns by four rows: eight cut-out cards per A4 page. */
@media print {
  .credential-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 6mm;
  }

  .credential-card {
    height: 62mm;
  }
}
</style>
