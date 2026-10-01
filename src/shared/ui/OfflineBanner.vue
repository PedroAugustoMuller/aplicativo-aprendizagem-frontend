<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ savedAt: Date | null }>()
const { t, locale } = useI18n()

const time = computed(() =>
  props.savedAt === null ? '' : props.savedAt.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' }),
)
</script>

<template>
  <v-alert
    v-if="savedAt !== null"
    type="warning"
    variant="tonal"
    density="compact"
    class="mb-4"
    data-testid="offline-banner"
    :text="t('offline.banner', { time })"
  />
</template>
