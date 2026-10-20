<script setup lang="ts">
import { computed, ref, watch, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOnline } from '@vueuse/core'
import { useClassroomStore } from '@/modules/identity/application/classroomStore'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { ApiError } from '@/shared/api/error'
import type { Classroom } from '@/modules/identity/domain/Classroom'
import OfflineHint from '@/shared/ui/OfflineHint.vue'
import { useFocusOnce } from '@/shared/ui/useFocusOnce'

const props = defineProps<{ modelValue: boolean; classroom: Classroom | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const { t, te } = useI18n()
const store = useClassroomStore()
const online = useOnline()

const name = ref('')
const subjectIds = ref<string[]>([])
const busy = ref(false)
const error = ref<ApiError | null>(null)
let requestId = ''

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      requestId = globalThis.crypto.randomUUID()
      name.value = props.classroom?.name ?? ''
      subjectIds.value = []
      error.value = null
    }
  },
  { immediate: true },
)

// Subjects are picked only when creating; afterwards "Matérias da turma" manages them.
const subjectItems = computed(() =>
  store.subjects.filter((subject) => subject.active).map((subject) => ({ title: subject.name, value: subject.id })),
)
const message = computed(() => (error.value === null ? null : apiErrorMessage(error.value, t, te)))
const fieldMessages = (field: string): string[] =>
  (error.value?.fields?.[field] ?? []).map((entry) => apiErrorMessage(new ApiError(entry.code, entry.params), t, te))
const canSave = computed(() => online.value && !busy.value && name.value.trim() !== '')

async function save(): Promise<void> {
  if (!canSave.value) {
    return
  }

  busy.value = true
  error.value = null
  try {
    await (props.classroom === null
      ? store.create(requestId, { name: name.value.trim(), subjectIds: subjectIds.value })
      : store.rename(props.classroom.id, name.value.trim()))
    emit('update:modelValue', false)
  } catch (failure: unknown) {
    error.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
  } finally {
    busy.value = false
  }
}

// Not Vuetify's `autofocus`: its late second focus could pull a user back from the next field (useFocusOnce).
const firstField = ref<ComponentPublicInstance | null>(null)
useFocusOnce(firstField)
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="480"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card data-testid="classroom-form">
      <v-card-title>{{ classroom === null ? t('classrooms.create') : t('classrooms.edit') }}</v-card-title>
      <v-card-text>
        <OfflineHint />
        <v-form @submit.prevent="save">
          <v-text-field
            v-model="name"
            data-testid="classroom-form-name"
            :label="t('classrooms.name')"
            :error-messages="fieldMessages('name')"
            maxlength="80"
            ref="firstField"
          />
          <v-select
            v-if="classroom === null"
            v-model="subjectIds"
            data-testid="classroom-form-subjects"
            :label="t('classrooms.subjectsLabel')"
            :items="subjectItems"
            :error-messages="fieldMessages('subject_ids')"
            multiple
            chips
            closable-chips
          />
        </v-form>
        <v-alert
          v-if="message"
          type="error"
          variant="tonal"
          data-testid="classroom-form-error"
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
          data-testid="classroom-form-save"
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
