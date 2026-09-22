<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useRosterStore } from '@/modules/identity/application/rosterStore'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { canRetry as canRetryError } from '@/shared/api/canRetry'

const { t, te } = useI18n()
const route = useRoute()
const roster = useRosterStore()

const classroomId = computed(() => (typeof route.params.classroomId === 'string' ? route.params.classroomId : ''))
const appUrl = globalThis.location.origin
const errorMessage = computed(() => (roster.error === null ? null : apiErrorMessage(roster.error, t, te)))
const canRetry = computed(() => canRetryError(roster.error))

function load(): void {
  void roster.loadSlips(classroomId.value)
}

onMounted(load)
// vue-router reuses this component instance when only the route param
// changes, so navigating from one classroom's slips straight to another's
// would otherwise keep showing the first classroom's plaintext passwords
// under the second classroom's name.
watch(classroomId, load)

const print = () => globalThis.print()
</script>

<template>
  <div>
    <div class="d-flex align-center mb-4 no-print">
      <h1 class="text-h5">
        {{ t('slips.title') }}
      </h1>
      <v-spacer />
      <v-btn
        color="primary"
        data-testid="slips-print"
        :disabled="roster.slips.length === 0"
        @click="print"
      >
        {{ t('slips.print') }}
      </v-btn>
    </div>

    <p class="text-body-2 mb-4 no-print">
      {{ t('slips.intro') }}
    </p>

    <v-progress-linear
      v-if="roster.loading"
      indeterminate
      class="no-print"
    />
    <v-alert
      v-else-if="errorMessage"
      type="error"
      variant="tonal"
      class="mb-4 no-print"
      data-testid="slips-error"
    >
      {{ errorMessage }}
      <template
        v-if="canRetry"
        #append
      >
        <v-btn
          variant="text"
          data-testid="slips-retry"
          @click="roster.loadSlips(classroomId)"
        >
          {{ t('common.retry') }}
        </v-btn>
      </template>
    </v-alert>
    <v-alert
      v-else-if="roster.slips.length === 0"
      type="info"
      variant="tonal"
      data-testid="slips-empty"
      :text="t('slips.empty')"
    />
    <div
      v-else
      class="slips"
      data-testid="slips-grid"
    >
      <section
        v-for="slip in roster.slips"
        :key="slip.userId"
        class="slip"
        :data-testid="`slip-${slip.userId}`"
      >
        <strong class="slip__name">{{ slip.name }}</strong>
        <dl>
          <dt>{{ t('credentials.login') }}</dt>
          <dd class="slip__mono">
            {{ slip.login }}
          </dd>
          <dt>{{ t('credentials.password') }}</dt>
          <dd class="slip__mono">
            {{ slip.temporaryPassword }}
          </dd>
        </dl>
        <small>{{ t('slips.where', { url: appUrl }) }}</small>
      </section>
    </div>
  </div>
</template>

<style scoped>
.slips {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: 0.75rem;
}

.slip {
  border: 1px dashed rgb(var(--v-theme-on-surface));
  border-radius: 4px;
  padding: 0.75rem;
  break-inside: avoid;
}

.slip dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.25rem 0.75rem;
  margin: 0.5rem 0;
}

.slip__mono {
  font-family: ui-monospace, monospace;
  font-size: 1.1rem;
  letter-spacing: 0.05em;
}

@media print {
  .no-print {
    display: none !important;
  }

  .slips {
    grid-template-columns: repeat(2, 1fr);
  }

  .slip {
    border-color: #000;
    color: #000;
  }
}
</style>
