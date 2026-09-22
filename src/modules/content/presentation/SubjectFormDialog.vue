<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSubjectStore } from '@/modules/content/application/subjectStore'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { ApiError } from '@/shared/api/error'
import { newId } from '@/shared/id/newId'
import type { Subject } from '@/modules/content/domain/Subject'

const props = defineProps<{ subject: Subject | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [] }>()

const { t, te } = useI18n()
const store = useSubjectStore()

// Generated once when the dialog OPENS and reused on every resubmit: a second
// click on Save after a timeout must send the same id, not a new one.
let id = newId()
const name = ref('')
const saving = ref(false)
const error = ref<ApiError | null>(null)

const errorMessage = computed(() => (error.value === null ? null : apiErrorMessage(error.value, t, te)))
const nameErrorMessages = computed(() =>
  error.value === null ? [] : error.value.fieldCodes('name').map((code) => t(`errors.${code}`)),
)
const canSave = computed(() => name.value.trim() !== '' && !saving.value)

watch(open, (isOpen) => {
  if (isOpen) {
    id = props.subject?.id ?? newId()
    name.value = props.subject?.name ?? ''
    error.value = null
  }
})

async function save(): Promise<void> {
  if (!canSave.value) {
    return
  }

  saving.value = true
  error.value = null

  try {
    if (props.subject === null) {
      await store.create({ id, name: name.value })
    } else {
      await store.rename(id, name.value)
    }
    emit('saved')
    open.value = false
  } catch (failure: unknown) {
    error.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <v-dialog
    v-model="open"
    max-width="480"
  >
    <v-card>
      <v-card-title>
        {{ subject === null ? t('subjects.create') : t('subjects.rename') }}
      </v-card-title>
      <v-card-text>
        <v-form @submit.prevent="save">
          <v-text-field
            v-model="name"
            data-testid="subject-name-input"
            :label="t('subjects.name')"
            :error-messages="nameErrorMessages"
          />
          <v-alert
            v-if="errorMessage"
            data-testid="subject-form-error"
            type="error"
            variant="tonal"
            class="mb-4"
            :text="errorMessage"
          />
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          data-testid="subject-cancel"
          variant="text"
          @click="open = false"
        >
          {{ t('common.cancel') }}
        </v-btn>
        <!-- .prevent for the same reason as LoginPage: without it a click both
             fires this handler and the form's native submission. -->
        <v-btn
          data-testid="subject-save"
          color="primary"
          :disabled="!canSave"
          :loading="saving"
          @click.prevent="save"
        >
          {{ t('common.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
