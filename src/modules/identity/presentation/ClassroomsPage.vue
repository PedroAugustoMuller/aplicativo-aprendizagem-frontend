<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOnline } from '@vueuse/core'
import { mdiAccountMultiple, mdiBookMultiple, mdiCancel, mdiPencil, mdiPlus } from '@mdi/js'
import { useClassroomStore } from '@/modules/identity/application/classroomStore'
import { useSessionStore } from '@/modules/identity/application/sessionStore'
import { useTeacherStore } from '@/modules/identity/application/teacherStore'
import AssignTeachersDialog from '@/modules/identity/presentation/AssignTeachersDialog.vue'
import ClassroomFormDialog from '@/modules/identity/presentation/ClassroomFormDialog.vue'
import ClassroomSubjectsDialog from '@/modules/identity/presentation/ClassroomSubjectsDialog.vue'
import { subjectsTaughtBy } from '@/modules/identity/domain/assignments'
import ApiErrorAlert from '@/shared/ui/ApiErrorAlert.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import OfflineBanner from '@/shared/ui/OfflineBanner.vue'
import OfflineHint from '@/shared/ui/OfflineHint.vue'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { ApiError } from '@/shared/api/error'
import type { Classroom } from '@/modules/identity/domain/Classroom'

const { t, te } = useI18n()
const store = useClassroomStore()
const teachers = useTeacherStore()
const session = useSessionStore()
const online = useOnline()

const isAdmin = computed(() => session.knownUser?.role === 'admin')
const formOpen = ref(false)
const editing = ref<Classroom | null>(null)
const assigning = ref<Classroom | null>(null)
const subjectsOf = ref<Classroom | null>(null)
const deactivating = ref<Classroom | null>(null)
const busy = ref(false)
const actionError = ref<ApiError | null>(null)
const actionMessage = computed(() => (actionError.value === null ? null : apiErrorMessage(actionError.value, t, te)))

onMounted(() => {
  void store.load()

  // Only admins may list teachers (backend); teachers see "you and N more".
  if (isAdmin.value) {
    void teachers.load()
  }
})

const subjectsLine = (classroom: Classroom): string =>
  classroom.subjectIds.length === 0
    ? t('classrooms.noSubjects')
    : classroom.subjectIds.map((id) => store.subjectName(id) ?? '…').join(' · ')

const scopeOf = (subjectId: string | null): string =>
  subjectId === null ? t('classrooms.wholeClass') : (store.subjectName(subjectId) ?? '…')

function teacherLine(classroom: Classroom): string {
  if (classroom.assignments.length === 0) {
    return t('classrooms.noTeachers')
  }

  if (isAdmin.value) {
    return classroom.assignments
      .map((a) => t('classrooms.teacherScope', {
        name: teachers.teachers.find((teacher) => teacher.id === a.teacherId)?.name ?? '…',
        scope: scopeOf(a.subjectId),
      }))
      .join(', ')
  }

  // Teachers cannot list teachers (admin-only endpoint): their own scope, then "and N more".
  const me = session.knownUser?.userId ?? ''
  const mine = classroom.assignments.some((a) => a.teacherId === me && a.subjectId === null)
    ? t('classrooms.wholeClass')
    : subjectsTaughtBy(classroom, me).map((id) => store.subjectName(id) ?? '…').join(', ')
  const others = new Set(classroom.assignments.filter((a) => a.teacherId !== me).map((a) => a.teacherId)).size

  return others === 0 ? t('classrooms.youScope', { scope: mine }) : t('classrooms.youScopeAndOthers', { scope: mine, count: others })
}

function openForm(classroom: Classroom | null): void {
  editing.value = classroom
  formOpen.value = true
}

async function confirmDeactivate(): Promise<void> {
  if (deactivating.value === null || busy.value) {
    return
  }

  busy.value = true
  actionError.value = null

  try {
    await store.deactivate(deactivating.value.id)
  } catch (failure: unknown) {
    actionError.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
  } finally {
    busy.value = false
    deactivating.value = null
  }
}
</script>

<template>
  <div>
    <div class="d-flex align-center flex-wrap ga-2 mb-4">
      <h1 class="text-h5 me-auto">
        {{ t('classrooms.title') }}
      </h1>
      <v-btn
        v-if="isAdmin"
        color="primary"
        :prepend-icon="mdiPlus"
        :disabled="!online"
        :title="online ? undefined : t('offline.writeDisabled')"
        data-testid="classrooms-create"
        @click="openForm(null)"
      >
        {{ t('classrooms.create') }}
      </v-btn>
    </div>

    <OfflineBanner :saved-at="store.savedAt" />
    <OfflineHint v-if="isAdmin" />

    <v-alert
      v-if="actionMessage"
      type="error"
      variant="tonal"
      closable
      class="mb-4"
      :text="actionMessage"
      @click:close="actionError = null"
    />

    <v-progress-linear
      v-if="store.loading"
      indeterminate
      data-testid="classrooms-loading"
    />

    <ApiErrorAlert
      v-else-if="store.error"
      :error="store.error"
      testid="classrooms"
      @retry="store.load()"
    />

    <v-alert
      v-else-if="store.classrooms.length === 0"
      type="info"
      variant="tonal"
      data-testid="classrooms-empty"
      :text="t('classrooms.empty')"
    />

    <v-row
      v-else
      data-testid="classrooms-list"
    >
      <v-col
        v-for="classroom in store.classrooms"
        :key="classroom.id"
        cols="12"
        sm="6"
        md="4"
      >
        <v-card
          :data-testid="`classroom-${classroom.id}`"
          :to="`/classrooms/${classroom.id}`"
          class="h-100"
          variant="tonal"
        >
          <v-card-item>
            <v-card-title class="text-wrap">
              {{ classroom.name }}
            </v-card-title>
            <v-card-subtitle>{{ subjectsLine(classroom) }}</v-card-subtitle>
            <template
              v-if="!classroom.active"
              #append
            >
              <v-chip size="small">
                {{ t('classrooms.inactive') }}
              </v-chip>
            </template>
          </v-card-item>
          <v-card-text>
            <div>{{ t('classrooms.students', classroom.studentCount) }}</div>
            <div class="text-medium-emphasis">
              {{ teacherLine(classroom) }}
            </div>
          </v-card-text>
        </v-card>
        <div
          v-if="isAdmin"
          class="d-flex flex-wrap ga-1 mt-1"
        >
          <v-btn
            size="small"
            variant="text"
            :prepend-icon="mdiPencil"
            :disabled="!online"
            :data-testid="`classroom-edit-${classroom.id}`"
            @click="openForm(classroom)"
          >
            {{ t('classrooms.edit') }}
          </v-btn>
          <v-btn
            size="small"
            variant="text"
            :prepend-icon="mdiBookMultiple"
            :disabled="!online"
            :data-testid="`classroom-subjects-${classroom.id}`"
            @click="subjectsOf = classroom"
          >
            {{ t('classrooms.subjects') }}
          </v-btn>
          <v-btn
            size="small"
            variant="text"
            :prepend-icon="mdiAccountMultiple"
            :disabled="!online"
            :data-testid="`classroom-teachers-${classroom.id}`"
            @click="assigning = classroom"
          >
            {{ t('classrooms.teachers') }}
          </v-btn>
          <v-btn
            v-if="classroom.active"
            size="small"
            variant="text"
            color="error"
            :prepend-icon="mdiCancel"
            :disabled="!online"
            :data-testid="`classroom-deactivate-${classroom.id}`"
            @click="deactivating = classroom"
          >
            {{ t('classrooms.deactivate') }}
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <ClassroomFormDialog
      v-model="formOpen"
      :classroom="editing"
    />
    <AssignTeachersDialog
      :model-value="assigning !== null"
      :classroom="assigning"
      @update:model-value="(open) => { if (!open) assigning = null }"
    />
    <ClassroomSubjectsDialog
      :model-value="subjectsOf !== null"
      :classroom="subjectsOf"
      @update:model-value="(open) => { if (!open) subjectsOf = null }"
    />
    <ConfirmDialog
      :model-value="deactivating !== null"
      :title="t('classrooms.deactivateTitle', { name: deactivating?.name ?? '' })"
      :message="t('classrooms.deactivateMessage')"
      :confirm-label="t('classrooms.deactivate')"
      :busy="busy"
      testid="classroom-deactivate-dialog"
      @update:model-value="(open) => { if (!open) deactivating = null }"
      @confirm="confirmDeactivate"
    />
  </div>
</template>
