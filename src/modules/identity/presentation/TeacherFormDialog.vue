<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOnline } from '@vueuse/core'
import { useTeacherStore } from '@/modules/identity/application/teacherStore'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { ApiError } from '@/shared/api/error'
import type { IssuedAccount } from '@/modules/identity/domain/IssuedAccount'
import OfflineHint from '@/shared/ui/OfflineHint.vue'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; created: [account: IssuedAccount] }>()

const { t, te } = useI18n()
const store = useTeacherStore()
const online = useOnline()

const name = ref('')
const email = ref('')
const busy = ref(false)
const error = ref<ApiError | null>(null)
// One id per opening: a retry after a timeout replays the original create.
let requestId = ''

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      requestId = globalThis.crypto.randomUUID()
      name.value = ''
      email.value = ''
      error.value = null
    }
  },
  { immediate: true },
)

const message = computed(() => (error.value === null ? null : apiErrorMessage(error.value, t, te)))
const fieldMessages = (field: string): string[] =>
  (error.value?.fields?.[field] ?? []).map((entry) => apiErrorMessage(new ApiError(entry.code, entry.params), t, te))
const canSave = computed(() => online.value && !busy.value && name.value.trim() !== '' && email.value.trim() !== '')

async function save(): Promise<void> {
  if (!canSave.value) {
    return
  }

  busy.value = true
  error.value = null

  try {
    const account = await store.create({ id: requestId, name: name.value.trim(), email: email.value.trim() })
    emit('update:modelValue', false)
    emit('created', account)
  } catch (failure: unknown) {
    error.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="480"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card data-testid="teacher-form">
      <v-card-title>{{ t('teachers.create') }}</v-card-title>
      <v-card-text>
        <OfflineHint />
        <v-form @submit.prevent="save">
          <v-text-field
            v-model="name"
            data-testid="teacher-form-name"
            :label="t('teachers.name')"
            :error-messages="fieldMessages('name')"
            maxlength="120"
            autofocus
          />
          <v-text-field
            v-model="email"
            data-testid="teacher-form-email"
            :label="t('teachers.email')"
            type="email"
            autocapitalize="off"
            :error-messages="fieldMessages('email')"
            maxlength="255"
          />
        </v-form>
        <v-alert
          v-if="message"
          type="error"
          variant="tonal"
          data-testid="teacher-form-error"
          :text="message"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="emit('update:modelValue', false)"
        >
          {{ t('common.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          data-testid="teacher-form-save"
          :loading="busy"
          :disabled="!canSave"
          @click.prevent="save"
        >
          {{ t('common.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
