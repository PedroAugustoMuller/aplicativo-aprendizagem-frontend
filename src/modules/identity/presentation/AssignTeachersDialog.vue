<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOnline } from '@vueuse/core'
import { useClassroomStore } from '@/modules/identity/application/classroomStore'
import { useTeacherStore } from '@/modules/identity/application/teacherStore'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { ApiError } from '@/shared/api/error'
import type { Classroom } from '@/modules/identity/domain/Classroom'

const props = defineProps<{ modelValue: boolean; classroom: Classroom | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const { t, te } = useI18n()
const classrooms = useClassroomStore()
const teachers = useTeacherStore()
const online = useOnline()

const selected = ref<string[]>([])
const busy = ref(false)
const error = ref<ApiError | null>(null)

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      selected.value = [...(props.classroom?.teacherIds ?? [])]
      error.value = null
    }
  },
  { immediate: true },
)

const items = computed(() =>
  teachers.teachers
    .filter((teacher) => teacher.active || selected.value.includes(teacher.id))
    .map((teacher) => ({ title: teacher.name, value: teacher.id })),
)
const message = computed(() => (error.value === null ? null : apiErrorMessage(error.value, t, te)))

async function save(): Promise<void> {
  if (props.classroom === null || busy.value || !online.value) {
    return
  }

  busy.value = true
  error.value = null

  try {
    await classrooms.assignTeachers(props.classroom.id, selected.value)
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
    <v-card data-testid="assign-teachers">
      <v-card-title class="text-wrap">
        {{ t('classrooms.assignTitle', { name: classroom?.name ?? '' }) }}
      </v-card-title>
      <v-card-text>
        <v-autocomplete
          v-model="selected"
          :items="items"
          :label="t('classrooms.teachers')"
          multiple
          chips
          closable-chips
          data-testid="assign-teachers-select"
        />
        <v-alert
          v-if="message"
          type="error"
          variant="tonal"
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
          data-testid="assign-teachers-save"
          :loading="busy"
          :disabled="!online"
          @click.prevent="save"
        >
          {{ t('common.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
