<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import {
  mdiAccountRemove,
  mdiCancel,
  mdiDotsVertical,
  mdiLockReset,
  mdiPlus,
  mdiPrinter,
  mdiRestore,
  mdiSwapHorizontal,
} from '@mdi/js'
import { useRosterStore } from '@/modules/identity/application/rosterStore'
import { useClassroomStore } from '@/modules/identity/application/classroomStore'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { canRetry as canRetryError } from '@/shared/api/canRetry'
import { ApiError } from '@/shared/api/error'
import SubjectLabel from '@/shared/ui/SubjectLabel.vue'
import PasteStudentsDialog from '@/modules/identity/presentation/PasteStudentsDialog.vue'
import MoveStudentDialog from '@/modules/identity/presentation/MoveStudentDialog.vue'
import TemporaryPasswordDialog from '@/modules/identity/presentation/TemporaryPasswordDialog.vue'
import type { AccountDetail, AccountSummary } from '@/modules/identity/domain/Account'

type RowActionType = 'reset' | 'unenrol' | 'toggle'

const route = useRoute()
const classroomId = computed(() => String(route.params.classroomId))

const { t, te } = useI18n()
const { mobile } = useDisplay()
const roster = useRosterStore()
const classroomStore = useClassroomStore()

const classroom = computed(() => classroomStore.find(classroomId.value))
const errorMessage = computed(() => (roster.error === null ? null : apiErrorMessage(roster.error, t, te)))
const canRetry = computed(() => canRetryError(roster.error))

const showPaste = ref(false)

const showMove = ref(false)
const movingStudent = ref<AccountSummary | null>(null)

const showCredentials = ref(false)
const credentials = ref<{ name: string; login: string; password: string } | null>(null)

const pendingAction = ref<{ type: RowActionType; student: AccountSummary } | null>(null)
const actionLoading = ref(false)
const showConfirm = computed({
  get: () => pendingAction.value !== null,
  set: (value: boolean) => {
    if (!value) {
      pendingAction.value = null
    }
  },
})

const actionTitle = computed(() => {
  if (pendingAction.value === null) {
    return ''
  }
  const { type, student } = pendingAction.value
  if (type === 'toggle') {
    return t(student.active ? 'roster.deactivate' : 'roster.reactivate')
  }
  return t(type === 'reset' ? 'roster.resetPassword' : 'roster.unenrol')
})

const actionBody = computed(() => {
  if (pendingAction.value === null) {
    return ''
  }
  const { type, student } = pendingAction.value
  if (type === 'reset') {
    return t('roster.resetConfirm', { name: student.name })
  }
  if (type === 'unenrol') {
    return t('roster.unenrolConfirm', { name: student.name })
  }
  return student.active ? t('roster.deactivateConfirm', { name: student.name }) : ''
})

// Row-action failures surface in a snackbar rather than an inline alert: these
// are single-step confirmations, not forms, so there is nowhere better for a
// 409/422 to land once the confirmation dialog has closed.
const rowError = ref<ApiError | null>(null)
const rowErrorMessage = computed(() => (rowError.value === null ? null : apiErrorMessage(rowError.value, t, te)))
const showRowError = computed({
  get: () => rowError.value !== null,
  set: (value: boolean) => {
    if (!value) {
      rowError.value = null
    }
  },
})

function showTemporaryPassword(detail: AccountDetail): void {
  credentials.value = { name: detail.name, login: detail.login, password: detail.temporaryPassword ?? '' }
  showCredentials.value = true
}

function openAction(type: RowActionType, student: AccountSummary): void {
  pendingAction.value = { type, student }
}

function openMove(student: AccountSummary): void {
  movingStudent.value = student
  showMove.value = true
}

async function confirmAction(): Promise<void> {
  if (pendingAction.value === null) {
    return
  }
  const { type, student } = pendingAction.value

  actionLoading.value = true

  try {
    if (type === 'reset') {
      const detail = await roster.resetPassword(student.id)
      pendingAction.value = null
      showTemporaryPassword(detail)
    } else if (type === 'unenrol') {
      await roster.unenrol(student.id)
      pendingAction.value = null
    } else {
      await roster.setActive(student.id, !student.active)
      pendingAction.value = null
    }
  } catch (failure: unknown) {
    pendingAction.value = null
    rowError.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
  } finally {
    actionLoading.value = false
  }
}

function load(): void {
  void roster.load(classroomId.value)
  if (classroomStore.find(classroomId.value) === null) {
    void classroomStore.load()
  }
}

onMounted(load)
// vue-router reuses this component instance when only the route param changes
// (e.g. navigating from one classroom's roster straight to another's), so
// onMounted alone would keep showing the previous classroom's roster.
watch(classroomId, load)
</script>

<template>
  <div>
    <div class="d-flex align-center justify-space-between mb-4 flex-wrap ga-2">
      <div>
        <h1 class="text-h5">
          {{ classroom === null ? t('roster.title') : classroom.name }}
        </h1>
        <div
          v-if="classroom !== null"
          class="text-body-2 text-medium-emphasis"
        >
          <SubjectLabel :subject-id="classroom.subjectId" />
        </div>
      </div>
      <div class="d-flex ga-2">
        <v-btn
          data-testid="roster-paste"
          color="primary"
          :prepend-icon="mdiPlus"
          @click="showPaste = true"
        >
          {{ t('roster.add') }}
        </v-btn>
        <v-btn
          data-testid="roster-print-slips"
          variant="text"
          :prepend-icon="mdiPrinter"
          :to="`/classrooms/${classroomId}/credentials`"
        >
          {{ t('roster.printSlips') }}
        </v-btn>
      </div>
    </div>

    <v-progress-linear
      v-if="roster.loading"
      indeterminate
      data-testid="roster-loading"
    />

    <v-alert
      v-else-if="errorMessage"
      type="error"
      variant="tonal"
      data-testid="roster-error"
      class="mb-4"
    >
      {{ errorMessage }}
      <template
        v-if="canRetry"
        #append
      >
        <v-btn
          variant="text"
          data-testid="roster-retry"
          @click="roster.load(classroomId)"
        >
          {{ t('common.retry') }}
        </v-btn>
      </template>
    </v-alert>

    <v-alert
      v-else-if="roster.students.length === 0"
      type="info"
      variant="tonal"
      data-testid="roster-empty"
      :text="t('roster.empty')"
    />

    <v-list
      v-else
      data-testid="roster-list"
    >
      <v-list-item
        v-for="student in roster.students"
        :key="student.id"
        :data-testid="`student-row-${student.id}`"
        :title="student.name"
      >
        <template #subtitle>
          <span style="font-family: monospace;">{{ student.login }}</span>
        </template>
        <template #append>
          <v-chip
            v-if="student.mustChangePassword"
            :text="t('roster.pendingPassword')"
            size="small"
            class="mr-2"
          />
          <v-chip
            v-if="!student.active"
            :text="t('roster.inactive')"
            size="small"
            class="mr-2"
          />

          <v-menu v-if="mobile">
            <template #activator="{ props: menuProps }">
              <v-btn
                v-bind="menuProps"
                :icon="mdiDotsVertical"
                variant="text"
                :aria-label="t('roster.actions')"
              />
            </template>
            <v-list>
              <v-list-item
                :data-testid="`student-reset-${student.id}`"
                :prepend-icon="mdiLockReset"
                :title="t('roster.resetPassword')"
                @click="openAction('reset', student)"
              />
              <v-list-item
                :data-testid="`student-move-${student.id}`"
                :prepend-icon="mdiSwapHorizontal"
                :title="t('roster.move')"
                @click="openMove(student)"
              />
              <v-list-item
                :data-testid="`student-unenrol-${student.id}`"
                :prepend-icon="mdiAccountRemove"
                :title="t('roster.unenrol')"
                @click="openAction('unenrol', student)"
              />
              <v-list-item
                :data-testid="`student-toggle-${student.id}`"
                :prepend-icon="student.active ? mdiCancel : mdiRestore"
                :title="t(student.active ? 'roster.deactivate' : 'roster.reactivate')"
                @click="openAction('toggle', student)"
              />
            </v-list>
          </v-menu>
          <template v-else>
            <v-btn
              :data-testid="`student-reset-${student.id}`"
              :icon="mdiLockReset"
              variant="text"
              :aria-label="t('roster.resetPassword')"
              @click="openAction('reset', student)"
            />
            <v-btn
              :data-testid="`student-move-${student.id}`"
              :icon="mdiSwapHorizontal"
              variant="text"
              :aria-label="t('roster.move')"
              @click="openMove(student)"
            />
            <v-btn
              :data-testid="`student-unenrol-${student.id}`"
              :icon="mdiAccountRemove"
              variant="text"
              :aria-label="t('roster.unenrol')"
              @click="openAction('unenrol', student)"
            />
            <v-btn
              :data-testid="`student-toggle-${student.id}`"
              :icon="student.active ? mdiCancel : mdiRestore"
              variant="text"
              :aria-label="t(student.active ? 'roster.deactivate' : 'roster.reactivate')"
              @click="openAction('toggle', student)"
            />
          </template>
        </template>
      </v-list-item>
    </v-list>

    <PasteStudentsDialog
      v-model:open="showPaste"
      :classroom-id="classroomId"
    />

    <MoveStudentDialog
      v-model:open="showMove"
      :student="movingStudent"
    />

    <TemporaryPasswordDialog
      v-model:open="showCredentials"
      :name="credentials?.name ?? ''"
      :login="credentials?.login ?? ''"
      :password="credentials?.password ?? ''"
    />

    <v-dialog
      v-model="showConfirm"
      max-width="480"
    >
      <v-card>
        <v-card-title>{{ actionTitle }}</v-card-title>
        <v-card-text>{{ actionBody }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showConfirm = false"
          >
            {{ t('common.cancel') }}
          </v-btn>
          <v-btn
            data-testid="roster-action-confirm"
            color="primary"
            :loading="actionLoading"
            @click="confirmAction"
          >
            {{ actionTitle }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar
      v-model="showRowError"
      color="error"
      data-testid="roster-row-error"
    >
      {{ rowErrorMessage }}
    </v-snackbar>
  </div>
</template>
