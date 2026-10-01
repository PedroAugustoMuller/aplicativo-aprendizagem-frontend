<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { IssuedAccount } from '@/modules/identity/domain/IssuedAccount'

defineProps<{ modelValue: boolean; account: IssuedAccount | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const { t } = useI18n()
// Templates cannot reach `window`; printing shows only the .print-area (print.css).
const print = (): void => globalThis.print()
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="420"
    persistent
  >
    <v-card
      v-if="account"
      data-testid="password-dialog"
    >
      <v-card-title>{{ t('accounts.passwordTitle') }}</v-card-title>
      <v-card-text>
        <div class="print-area pa-4">
          <p class="text-subtitle-1 font-weight-medium mb-2">
            {{ account.name }}
          </p>
          <p>
            {{ t('accounts.login') }}:
            <strong data-testid="password-dialog-login">{{ account.login }}</strong>
          </p>
          <p class="text-h6">
            {{ t('accounts.temporaryPassword') }}:
            <strong
              class="font-monospace"
              data-testid="password-dialog-password"
            >{{ account.temporaryPassword ?? '—' }}</strong>
          </p>
          <p class="text-caption">
            {{ t('accounts.changeOnFirstLogin') }}
          </p>
        </div>
        <v-alert
          type="warning"
          variant="tonal"
          density="compact"
          class="no-print mt-2"
          :text="t('accounts.shownOnce')"
        />
      </v-card-text>
      <v-card-actions class="no-print">
        <v-spacer />
        <v-btn
          variant="text"
          data-testid="password-dialog-print"
          @click="print"
        >
          {{ t('accounts.print') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          data-testid="password-dialog-close"
          @click="emit('update:modelValue', false)"
        >
          {{ t('common.close') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
