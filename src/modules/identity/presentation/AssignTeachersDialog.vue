<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useClassroomStore } from '@/modules/identity/application/classroomStore'
import { useTeacherStore } from '@/modules/identity/application/teacherStore'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { ApiError } from '@/shared/api/error'
import type { ClassroomSummary } from '@/modules/identity/domain/Classroom'

const props = defineProps<{ classroom: ClassroomSummary | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [] }>()

const { t, te } = useI18n()
const classroomStore = useClassroomStore()
const teacherStore = useTeacherStore()

const selected = ref<string[]>([])
const saving = ref(false)
const error = ref<ApiError | null>(null)

const errorMessage = computed(() => (error.value === null ? null : apiErrorMessage(error.value, t, te)))
// A teacher who was deactivated after being assigned still appears in
// classroom.teacherIds - if `items` only listed active teachers, that id
// would have no matching entry and the multi-select would render its chip
// with the raw UUID instead of a name.
const items = computed(() => {
  const assignedIds = new Set(props.classroom?.teacherIds ?? [])
  return teacherStore.teachers
    .filter((teacher) => teacher.active || assignedIds.has(teacher.id))
    .map((teacher) => ({
      title: teacher.active ? teacher.name : t('classrooms.inactiveTeacher', { name: teacher.name }),
      value: teacher.id,
    }))
})

watch(open, (isOpen) => {
  if (isOpen) {
    // Pre-select from the classroom's current teachers - saving replaces the
    // whole set, which is exactly what a pre-selected multi-select expresses.
    selected.value = [...(props.classroom?.teacherIds ?? [])]
    error.value = null
    void teacherStore.load()
  }
})

async function save(): Promise<void> {
  if (props.classroom === null || saving.value) {
    return
  }

  saving.value = true
  error.value = null

  try {
    await classroomStore.assignTeachers(props.classroom.id, selected.value)
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
        {{ t('classrooms.teachers') }}
      </v-card-title>
      <v-card-text>
        <v-autocomplete
          v-model="selected"
          data-testid="assign-teachers-select"
          multiple
          chips
          :items="items"
          :loading="teacherStore.loading"
          :label="t('classrooms.teachers')"
        />
        <v-alert
          v-if="errorMessage"
          data-testid="assign-teachers-error"
          type="error"
          variant="tonal"
          class="mt-4"
          :text="errorMessage"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          data-testid="assign-teachers-cancel"
          variant="text"
          @click="open = false"
        >
          {{ t('common.cancel') }}
        </v-btn>
        <v-btn
          data-testid="assign-teachers-save"
          color="primary"
          :loading="saving"
          @click.prevent="save"
        >
          {{ t('common.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
