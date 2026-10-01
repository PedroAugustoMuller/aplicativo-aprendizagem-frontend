<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOnline } from '@vueuse/core'
import { useSubjectStore } from '@/modules/content/application/subjectStore'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { ApiError } from '@/shared/api/error'
import type { Subject } from '@/modules/content/domain/Subject'

const props = defineProps<{ modelValue: boolean; subject: Subject | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const { t, te } = useI18n()
const store = useSubjectStore()
const online = useOnline()

const name = ref('')
const busy = ref(false)
const error = ref<ApiError | null>(null)
// One id per opening: a retry after a timeout replays the original create.
let requestId = ''

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      requestId = globalThis.crypto.randomUUID()
      name.value = props.subject?.name ?? ''
      error.value = null
    }
  },
  { immediate: true },
)

const message = computed(() => (error.value === null ? null : apiErrorMessage(error.value, t, te)))
const nameErrors = computed(() =>
  (error.value?.fields?.name ?? []).map((entry) => apiErrorMessage(new ApiError(entry.code, entry.params), t, te)),
)
const canSave = computed(() => online.value && name.value.trim() !== '' && !busy.value)

async function save(): Promise<void> {
  if (!canSave.value) {
    return
  }

  busy.value = true
  error.value = null

  try {
    if (props.subject === null) {
      await store.create({ id: requestId, name: name.value.trim() })
    } else {
      await store.rename(props.subject.id, name.value.trim())
    }

    emit('update:modelValue', false)
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
    <v-card data-testid="subject-form">
      <v-card-title>{{ subject === null ? t('subjects.create') : t('subjects.rename') }}</v-card-title>
      <v-card-text>
        <v-form @submit.prevent="save">
          <v-text-field
            v-model="name"
            data-testid="subject-form-name"
            :label="t('subjects.name')"
            :error-messages="nameErrors"
            maxlength="80"
            autofocus
          />
        </v-form>
        <v-alert
          v-if="message"
          type="error"
          variant="tonal"
          data-testid="subject-form-error"
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
          data-testid="subject-form-save"
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
