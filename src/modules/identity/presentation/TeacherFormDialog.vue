<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTeacherStore } from '@/modules/identity/application/teacherStore'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { ApiError } from '@/shared/api/error'
import { newId } from '@/shared/id/newId'
import type { AccountDetail } from '@/modules/identity/domain/Account'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ created: [AccountDetail] }>()

const { t, te } = useI18n()
const store = useTeacherStore()

// Generated once when the dialog OPENS and reused on every resubmit: a second
// click on Save after a timeout must send the same id, not a new one.
let id = newId()
const name = ref('')
const email = ref('')
const saving = ref(false)
const error = ref<ApiError | null>(null)

const errorMessage = computed(() => (error.value === null ? null : apiErrorMessage(error.value, t, te)))
const nameErrorMessages = computed(() =>
  error.value === null ? [] : error.value.fieldCodes('name').map((code) => t(`errors.${code}`)),
)
const emailErrorMessages = computed(() =>
  error.value === null ? [] : error.value.fieldCodes('email').map((code) => t(`errors.${code}`)),
)
const canSave = computed(() => name.value.trim() !== '' && email.value.trim() !== '' && !saving.value)

watch(open, (isOpen) => {
  if (isOpen) {
    id = newId()
    name.value = ''
    email.value = ''
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
    const created = await store.create({ id, name: name.value, email: email.value })
    emit('created', created)
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
        {{ t('teachers.create') }}
      </v-card-title>
      <v-card-text>
        <v-form @submit.prevent="save">
          <v-text-field
            v-model="name"
            data-testid="teacher-name-input"
            :label="t('teachers.name')"
            :error-messages="nameErrorMessages"
          />
          <v-text-field
            v-model="email"
            type="email"
            data-testid="teacher-email-input"
            :label="t('teachers.email')"
            :error-messages="emailErrorMessages"
          />
          <v-alert
            v-if="errorMessage"
            data-testid="teacher-form-error"
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
          data-testid="teacher-cancel"
          variant="text"
          @click="open = false"
        >
          {{ t('common.cancel') }}
        </v-btn>
        <!-- .prevent for the same reason as SubjectFormDialog: without it a
             click both fires this handler and the form's native submission. -->
        <v-btn
          data-testid="teacher-save"
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
