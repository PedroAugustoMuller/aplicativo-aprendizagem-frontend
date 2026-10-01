<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import OfflineHint from '@/shared/ui/OfflineHint.vue'

defineProps<{
  modelValue: boolean
  title: string
  message: string
  confirmLabel: string
  testid: string
  busy?: boolean | undefined
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; confirm: [] }>()

const { t } = useI18n()
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="420"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card :data-testid="testid">
      <v-card-title class="text-wrap">
        {{ title }}
      </v-card-title>
      <v-card-text>
        <OfflineHint />
        {{ message }}
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          :data-testid="`${testid}-cancel`"
          @click="emit('update:modelValue', false)"
        >
          {{ t('common.cancel') }}
        </v-btn>
        <v-btn
          color="error"
          variant="flat"
          :loading="busy"
          :data-testid="`${testid}-confirm`"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
