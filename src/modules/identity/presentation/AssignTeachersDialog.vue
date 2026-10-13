<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOnline } from '@vueuse/core'
import { mdiClose, mdiPlus } from '@mdi/js'
import { useClassroomStore } from '@/modules/identity/application/classroomStore'
import { useTeacherStore } from '@/modules/identity/application/teacherStore'
import { redundantTeacherIds } from '@/modules/identity/domain/assignments'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { ApiError } from '@/shared/api/error'
import type { Classroom, TeacherAssignment } from '@/modules/identity/domain/Classroom'
import OfflineHint from '@/shared/ui/OfflineHint.vue'

const props = defineProps<{ modelValue: boolean; classroom: Classroom | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const { t, te } = useI18n()
const classrooms = useClassroomStore()
const teachers = useTeacherStore()
const online = useOnline()

// v-select cannot tell "no value" from null, so "whole class" travels as a sentinel.
const WHOLE = '__whole__'

interface Row {
  teacherId: string | null
  scope: string
}

const rows = ref<Row[]>([])
const busy = ref(false)
const error = ref<ApiError | null>(null)

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      rows.value = (props.classroom?.assignments ?? []).map((a) => ({ teacherId: a.teacherId, scope: a.subjectId ?? WHOLE }))
      error.value = null
    }
  },
  { immediate: true },
)

const teacherItems = computed(() =>
  teachers.teachers
    .filter((teacher) => teacher.active || rows.value.some((row) => row.teacherId === teacher.id))
    .map((teacher) => ({ title: teacher.name, value: teacher.id })),
)
const scopeItems = computed(() => [
  { title: t('classrooms.wholeClass'), value: WHOLE },
  ...(props.classroom?.subjectIds ?? []).map((id) => ({ title: classrooms.subjectName(id) ?? '…', value: id })),
])
const assignments = computed((): TeacherAssignment[] =>
  rows.value.flatMap((row) => (row.teacherId === null ? [] : [{ teacherId: row.teacherId, subjectId: row.scope === WHOLE ? null : row.scope }])),
)
const redundant = computed(() =>
  redundantTeacherIds(assignments.value)
    .map((id) => teachers.teachers.find((teacher) => teacher.id === id)?.name ?? '…')
    .join(', '),
)
const canSave = computed(() => online.value && !busy.value && redundant.value === '' && rows.value.every((row) => row.teacherId !== null))
const message = computed(() => (error.value === null ? null : apiErrorMessage(error.value, t, te)))

function addRow(): void {
  rows.value.push({ teacherId: null, scope: WHOLE })
}

function removeRow(index: number): void {
  rows.value.splice(index, 1)
}

async function save(): Promise<void> {
  if (props.classroom === null || !canSave.value) {
    return
  }

  busy.value = true
  error.value = null

  try {
    await classrooms.assignTeachers(props.classroom.id, assignments.value)
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
    max-width="560"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card data-testid="assign-teachers">
      <v-card-title class="text-wrap">
        {{ t('classrooms.assignTitle', { name: classroom?.name ?? '' }) }}
      </v-card-title>
      <v-card-text>
        <OfflineHint />
        <div
          v-for="(row, index) in rows"
          :key="index"
          class="d-flex flex-wrap align-center ga-2 mb-2"
        >
          <v-select
            v-model="row.teacherId"
            :items="teacherItems"
            :label="t('classrooms.teacher')"
            :data-testid="`assign-row-${index}-teacher`"
            class="flex-grow-1"
            hide-details
          />
          <v-select
            v-model="row.scope"
            :items="scopeItems"
            :label="t('classrooms.scope')"
            :data-testid="`assign-row-${index}-scope`"
            class="flex-grow-1"
            hide-details
          />
          <v-btn
            :icon="mdiClose"
            variant="text"
            size="small"
            :title="t('classrooms.removeAssignment')"
            :aria-label="t('classrooms.removeAssignment')"
            :data-testid="`assign-row-${index}-remove`"
            @click="removeRow(index)"
          />
        </div>
        <v-btn
          variant="tonal"
          :prepend-icon="mdiPlus"
          data-testid="assign-add"
          class="mb-2"
          @click="addRow"
        >
          {{ t('classrooms.addAssignment') }}
        </v-btn>
        <v-alert
          v-if="redundant !== ''"
          type="warning"
          variant="tonal"
          class="mb-2"
          data-testid="assign-redundant"
          :text="t('classrooms.redundant', { names: redundant })"
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
          :disabled="!canSave"
          @click.prevent="save"
        >
          {{ t('common.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
