<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useClassroomStore } from '@/modules/identity/application/classroomStore'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { ApiError } from '@/shared/api/error'
import { newId } from '@/shared/id/newId'
import SubjectSelect from '@/shared/ui/SubjectSelect.vue'
import type { ClassroomSummary } from '@/modules/identity/domain/Classroom'

const props = defineProps<{ classroom: ClassroomSummary | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [] }>()

const { t, te } = useI18n()
const store = useClassroomStore()

// Generated once when the dialog OPENS and reused on every resubmit: a second
// click on Save after a timeout must send the same id, not a new one.
let id = newId()
const name = ref('')
const subjectId = ref<string | null>(null)
const saving = ref(false)
const error = ref<ApiError | null>(null)

const errorMessage = computed(() => (error.value === null ? null : apiErrorMessage(error.value, t, te)))
const nameErrorMessages = computed(() =>
  error.value === null ? [] : error.value.fieldCodes('name').map((code) => t(`errors.${code}`)),
)
const canSave = computed(() => name.value.trim() !== '' && subjectId.value !== null && !saving.value)

watch(open, (isOpen) => {
  if (isOpen) {
    id = props.classroom?.id ?? newId()
    name.value = props.classroom?.name ?? ''
    subjectId.value = props.classroom?.subjectId ?? null
    error.value = null
  }
})

async function save(): Promise<void> {
  if (!canSave.value || subjectId.value === null) {
    return
  }

  saving.value = true
  error.value = null

  try {
    if (props.classroom === null) {
      await store.create({ id, name: name.value, subjectId: subjectId.value })
    } else {
      await store.update(id, { name: name.value, subjectId: subjectId.value })
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
        {{ classroom === null ? t('classrooms.create') : t('classrooms.edit') }}
      </v-card-title>
      <v-card-text>
        <v-form @submit.prevent="save">
          <v-text-field
            v-model="name"
            data-testid="classroom-name-input"
            :label="t('classrooms.name')"
            :error-messages="nameErrorMessages"
          />
          <SubjectSelect
            v-model="subjectId"
            data-testid="classroom-subject-select"
          />
          <v-alert
            v-if="errorMessage"
            data-testid="classroom-form-error"
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
          data-testid="classroom-cancel"
          variant="text"
          @click="open = false"
        >
          {{ t('common.cancel') }}
        </v-btn>
        <!-- .prevent for the same reason as SubjectFormDialog: without it a
             click both fires this handler and the form's native submission. -->
        <v-btn
          data-testid="classroom-save"
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
