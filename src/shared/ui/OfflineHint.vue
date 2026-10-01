<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useOnline } from '@vueuse/core'

const { t } = useI18n()
const online = useOnline()
</script>

<template>
  <!-- Visible text, not a tooltip: touch screens never show a title attribute,
    so without it a phone user only sees grey buttons with no reason. -->
  <v-alert
    v-if="!online"
    type="info"
    variant="tonal"
    density="compact"
    class="mb-4"
    data-testid="offline-hint"
    :text="t('offline.writeHint')"
  />
</template>
