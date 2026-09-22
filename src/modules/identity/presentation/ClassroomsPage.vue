<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useDisplay } from 'vuetify'
import { useI18n } from 'vue-i18n'
import { mdiAccountMultiple, mdiCancel, mdiPencil, mdiPlus } from '@mdi/js'
import { useClassroomStore } from '@/modules/identity/application/classroomStore'
import { useSessionStore } from '@/modules/identity/application/sessionStore'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { canRetry as canRetryError } from '@/shared/api/canRetry'
import { ApiError } from '@/shared/api/error'
import SubjectLabel from '@/shared/ui/SubjectLabel.vue'
import ClassroomFormDialog from '@/modules/identity/presentation/ClassroomFormDialog.vue'
import AssignTeachersDialog from '@/modules/identity/presentation/AssignTeachersDialog.vue'
import type { ClassroomSummary } from '@/modules/identity/domain/Classroom'

const { t, te } = useI18n()
const { mobile } = useDisplay()
const store = useClassroomStore()
const session = useSessionStore()

const isAdmin = computed(() => session.role === 'admin')
const errorMessage = computed(() => (store.error === null ? null : apiErrorMessage(store.error, t, te)))
const canRetry = computed(() => canRetryError(store.error))
const emptyMessage = computed(() => t(session.role === 'teacher' ? 'classrooms.emptyTeacher' : 'classrooms.empty'))

const showFormDialog = ref(false)
const editingClassroom = ref<ClassroomSummary | null>(null)

const showAssignDialog = ref(false)
const assigningClassroom = ref<ClassroomSummary | null>(null)

const showDeactivateConfirm = ref(false)
const deactivatingClassroom = ref<ClassroomSummary | null>(null)
const deactivating = ref(false)
const deactivateError = ref<ApiError | null>(null)
const deactivateErrorMessage = computed(() =>
  deactivateError.value === null ? null : apiErrorMessage(deactivateError.value, t, te),
)

function openCreate(): void {
  editingClassroom.value = null
  showFormDialog.value = true
}

function openEdit(classroom: ClassroomSummary): void {
  editingClassroom.value = classroom
  showFormDialog.value = true
}

function openAssign(classroom: ClassroomSummary): void {
  assigningClassroom.value = classroom
  showAssignDialog.value = true
}

function openDeactivateConfirm(classroom: ClassroomSummary): void {
  deactivatingClassroom.value = classroom
  deactivateError.value = null
  showDeactivateConfirm.value = true
}

async function confirmDeactivate(): Promise<void> {
  if (deactivatingClassroom.value === null) {
    return
  }

  deactivating.value = true
  deactivateError.value = null

  try {
    await store.deactivate(deactivatingClassroom.value.id)
    showDeactivateConfirm.value = false
  } catch (failure: unknown) {
    deactivateError.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
  } finally {
    deactivating.value = false
  }
}

onMounted(() => void store.load())
</script>

<template>
  <div>
    <div class="d-flex align-center justify-space-between mb-4">
      <h1 class="text-h5">
        {{ t('classrooms.title') }}
      </h1>
      <v-btn
        v-if="isAdmin"
        data-testid="classrooms-create"
        color="primary"
        :prepend-icon="mdiPlus"
        @click="openCreate"
      >
        {{ t('classrooms.create') }}
      </v-btn>
    </div>

    <v-progress-linear
      v-if="store.loading"
      indeterminate
      data-testid="classrooms-loading"
    />

    <v-alert
      v-else-if="errorMessage"
      type="error"
      variant="tonal"
      data-testid="classrooms-error"
      class="mb-4"
    >
      {{ errorMessage }}
      <template
        v-if="canRetry"
        #append
      >
        <v-btn
          variant="text"
          data-testid="classrooms-retry"
          @click="store.load()"
        >
          {{ t('common.retry') }}
        </v-btn>
      </template>
    </v-alert>

    <v-alert
      v-else-if="store.classrooms.length === 0"
      type="info"
      variant="tonal"
      data-testid="classrooms-empty"
      :text="emptyMessage"
    />

    <v-list
      v-else
      data-testid="classrooms-list"
    >
      <v-list-item
        v-for="classroom in store.classrooms"
        :key="classroom.id"
        :data-testid="`classroom-row-${classroom.id}`"
        :to="`/classrooms/${classroom.id}`"
        :title="classroom.name"
      >
        <template #subtitle>
          <SubjectLabel :subject-id="classroom.subjectId" />
          ·
          {{ t('classrooms.studentCount', { count: classroom.studentCount }, classroom.studentCount) }}
        </template>
        <template #append>
          <v-chip
            v-if="!classroom.active"
            :text="t('classrooms.inactive')"
            size="small"
            class="mr-2"
          />
          <template v-if="isAdmin">
            <v-btn
              :data-testid="`classroom-edit-${classroom.id}`"
              :icon="mobile ? mdiPencil : undefined"
              :prepend-icon="mobile ? undefined : mdiPencil"
              :aria-label="t('classrooms.edit')"
              variant="text"
              @click.stop.prevent="openEdit(classroom)"
            >
              <template v-if="!mobile">
                {{ t('classrooms.edit') }}
              </template>
            </v-btn>
            <v-btn
              :data-testid="`classroom-teachers-${classroom.id}`"
              :icon="mobile ? mdiAccountMultiple : undefined"
              :prepend-icon="mobile ? undefined : mdiAccountMultiple"
              :aria-label="t('classrooms.teachers')"
              variant="text"
              @click.stop.prevent="openAssign(classroom)"
            >
              <template v-if="!mobile">
                {{ t('classrooms.teachers') }}
              </template>
            </v-btn>
            <v-btn
              v-if="classroom.active"
              :data-testid="`classroom-deactivate-${classroom.id}`"
              :icon="mobile ? mdiCancel : undefined"
              :prepend-icon="mobile ? undefined : mdiCancel"
              :aria-label="t('classrooms.deactivate')"
              variant="text"
              @click.stop.prevent="openDeactivateConfirm(classroom)"
            >
              <template v-if="!mobile">
                {{ t('classrooms.deactivate') }}
              </template>
            </v-btn>
          </template>
        </template>
      </v-list-item>
    </v-list>

    <ClassroomFormDialog
      v-model:open="showFormDialog"
      :classroom="editingClassroom"
    />

    <AssignTeachersDialog
      v-model:open="showAssignDialog"
      :classroom="assigningClassroom"
    />

    <v-dialog
      v-model="showDeactivateConfirm"
      max-width="480"
    >
      <v-card>
        <v-card-title>{{ t('classrooms.deactivate') }}</v-card-title>
        <v-card-text>
          {{ deactivatingClassroom === null ? '' : t('classrooms.deactivateConfirm', { name: deactivatingClassroom.name }) }}
          <v-alert
            v-if="deactivateErrorMessage"
            data-testid="classroom-deactivate-error"
            type="error"
            variant="tonal"
            class="mt-4"
            :text="deactivateErrorMessage"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showDeactivateConfirm = false"
          >
            {{ t('common.cancel') }}
          </v-btn>
          <v-btn
            data-testid="classroom-deactivate-confirm"
            color="primary"
            :loading="deactivating"
            @click="confirmDeactivate"
          >
            {{ t('classrooms.deactivate') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
