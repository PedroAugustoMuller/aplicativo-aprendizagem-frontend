<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useOnline } from '@vueuse/core'
import { mdiChartBar, mdiAccountCheck, mdiAccountOff, mdiAccountPlus, mdiArrowLeft, mdiLockReset, mdiPrinter, mdiAccountRemove, mdiAccountSearch } from '@mdi/js'
import { useClassroomStore } from '@/modules/identity/application/classroomStore'
import { useRosterStore } from '@/modules/identity/application/rosterStore'
import AddStudentsDialog from '@/modules/identity/presentation/AddStudentsDialog.vue'
import StudentSearchDialog from '@/modules/identity/presentation/StudentSearchDialog.vue'
import TemporaryPasswordDialog from '@/modules/identity/presentation/TemporaryPasswordDialog.vue'
import ApiErrorAlert from '@/shared/ui/ApiErrorAlert.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import OfflineBanner from '@/shared/ui/OfflineBanner.vue'
import OfflineHint from '@/shared/ui/OfflineHint.vue'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { ApiError } from '@/shared/api/error'
import type { IssuedAccount } from '@/modules/identity/domain/IssuedAccount'
import type { Student } from '@/modules/identity/domain/Student'

const { t, te } = useI18n()
const route = useRoute()
const router = useRouter()
const classrooms = useClassroomStore()
const roster = useRosterStore()
const online = useOnline()

const classroomId = computed(() => {
  const param = route.params.classroomId

  return typeof param === 'string' ? param : ''
})
const classroom = computed(() => classrooms.find(classroomId.value))

const adding = ref(false)
const searching = ref(false)
const issued = ref<IssuedAccount | null>(null)
const resetting = ref<Student | null>(null)
const removing = ref<Student | null>(null)
const deactivating = ref<Student | null>(null)
const busy = ref(false)
const actionError = ref<ApiError | null>(null)
const actionMessage = computed(() => (actionError.value === null ? null : apiErrorMessage(actionError.value, t, te)))

onMounted(() => void classrooms.ensureLoaded())
watch(classroomId, (id) => void roster.load(id), { immediate: true })

async function run(action: () => Promise<void>): Promise<void> {
  if (busy.value) {
    return
  }

  busy.value = true
  actionError.value = null

  try {
    await action()
  } catch (failure: unknown) {
    actionError.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
  } finally {
    busy.value = false
    resetting.value = null
    removing.value = null
    deactivating.value = null
  }
}

const confirmReset = (): Promise<void> =>
  run(async () => {
    if (resetting.value !== null) {
      issued.value = await roster.resetPassword(classroomId.value, resetting.value.id)
    }
  })

const confirmRemove = (): Promise<void> =>
  run(async () => {
    if (removing.value !== null) {
      await roster.unenrol(classroomId.value, removing.value.id)
    }
  })

const confirmDeactivate = (): Promise<void> =>
  run(async () => {
    if (deactivating.value !== null) {
      await roster.setActive(classroomId.value, deactivating.value.id, false)
    }
  })

// Deactivating is destructive (confirmed); reactivating is one tap.
function toggle(student: Student): void {
  if (student.active) {
    deactivating.value = student
  } else {
    void run(() => roster.setActive(classroomId.value, student.id, true))
  }
}

const openSlips = (): Promise<void> => router.push(`/classrooms/${classroomId.value}/credentials`).then(() => undefined)
</script>

<template>
  <div>
    <v-btn
      to="/classrooms"
      variant="text"
      :prepend-icon="mdiArrowLeft"
      class="mb-2 px-0"
      data-testid="classroom-back"
    >
      {{ t('roster.back') }}
    </v-btn>

    <h1
      class="text-h5"
      data-testid="classroom-title"
    >
      {{ classroom?.name ?? '' }}
    </h1>
    <p class="text-medium-emphasis mb-4">
      {{ classroom === null ? '' : (classrooms.subjectName(classroom.subjectId) ?? '') }}
    </p>

    <div class="d-flex flex-wrap ga-2 mb-4">
      <v-btn
        color="primary"
        :prepend-icon="mdiAccountPlus"
        :disabled="!online"
        :title="online ? undefined : t('offline.writeDisabled')"
        data-testid="roster-add"
        @click="adding = true"
      >
        {{ t('roster.add') }}
      </v-btn>
      <v-btn
        variant="tonal"
        :prepend-icon="mdiAccountSearch"
        :disabled="!online"
        :title="online ? undefined : t('offline.writeDisabled')"
        data-testid="roster-add-existing"
        @click="searching = true"
      >
        {{ t('roster.addExisting') }}
      </v-btn>
      <v-btn
        variant="tonal"
        :prepend-icon="mdiPrinter"
        :to="`/classrooms/${classroomId}/credentials`"
        data-testid="roster-print"
      >
        {{ t('roster.print') }}
      </v-btn>
      <!-- A link by path: the progress grid belongs to the quiz module, which identity never imports. -->
      <v-btn
        variant="tonal"
        :prepend-icon="mdiChartBar"
        :to="`/classrooms/${classroomId}/progress`"
        data-testid="classroom-progress"
      >
        {{ t('progress.classroomButton') }}
      </v-btn>
    </div>

    <OfflineBanner :saved-at="roster.savedAt" />
    <OfflineHint />

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
      v-if="roster.loading"
      indeterminate
      data-testid="roster-loading"
    />

    <ApiErrorAlert
      v-else-if="roster.error"
      :error="roster.error"
      testid="roster"
      @retry="roster.load(classroomId)"
    />

    <v-alert
      v-else-if="roster.students.length === 0"
      type="info"
      variant="tonal"
      data-testid="roster-empty"
      :text="t('roster.empty')"
    />

    <v-list
      v-else
      lines="two"
      data-testid="roster-list"
    >
      <v-list-item
        v-for="student in roster.students"
        :key="student.id"
        :data-testid="`roster-student-${student.id}`"
        :title="student.name"
        :subtitle="student.username"
      >
        <template #append>
          <v-chip
            v-if="!student.active"
            size="small"
            class="me-2"
          >
            {{ t('accounts.inactive') }}
          </v-chip>
          <v-chip
            v-else-if="student.mustChangePassword"
            size="small"
            color="warning"
            class="me-2"
          >
            {{ t('accounts.pendingPassword') }}
          </v-chip>
          <v-btn
            :icon="mdiLockReset"
            variant="text"
            :disabled="!online || !student.active"
            :aria-label="t('accounts.resetPassword')"
            :title="t('accounts.resetPassword')"
            :data-testid="`roster-reset-${student.id}`"
            @click="resetting = student"
          />
          <v-btn
            :icon="student.active ? mdiAccountOff : mdiAccountCheck"
            variant="text"
            :disabled="!online"
            :aria-label="student.active ? t('accounts.deactivate') : t('accounts.reactivate')"
            :title="student.active ? t('accounts.deactivate') : t('accounts.reactivate')"
            :data-testid="`roster-toggle-${student.id}`"
            @click="toggle(student)"
          />
          <v-btn
            :icon="mdiAccountRemove"
            variant="text"
            :disabled="!online"
            :aria-label="t('roster.remove')"
            :title="t('roster.remove')"
            :data-testid="`roster-remove-${student.id}`"
            @click="removing = student"
          />
        </template>
      </v-list-item>
    </v-list>

    <AddStudentsDialog
      v-model="adding"
      :classroom-id="classroomId"
      @created="openSlips"
    />
    <StudentSearchDialog
      v-model="searching"
      :classroom-id="classroomId"
    />
    <TemporaryPasswordDialog
      :model-value="issued !== null"
      :account="issued"
      @update:model-value="(open) => { if (!open) issued = null }"
    />
    <ConfirmDialog
      :model-value="resetting !== null"
      :title="t('accounts.resetTitle', { name: resetting?.name ?? '' })"
      :message="t('accounts.resetMessage')"
      :confirm-label="t('accounts.resetPassword')"
      :busy="busy"
      testid="roster-reset-dialog"
      @update:model-value="(open) => { if (!open) resetting = null }"
      @confirm="confirmReset"
    />
    <ConfirmDialog
      :model-value="removing !== null"
      :title="t('roster.removeTitle', { name: removing?.name ?? '' })"
      :message="t('roster.removeMessage')"
      :confirm-label="t('roster.remove')"
      :busy="busy"
      testid="roster-remove-dialog"
      @update:model-value="(open) => { if (!open) removing = null }"
      @confirm="confirmRemove"
    />
    <ConfirmDialog
      :model-value="deactivating !== null"
      :title="t('accounts.deactivateTitle', { name: deactivating?.name ?? '' })"
      :message="t('accounts.deactivateMessage')"
      :confirm-label="t('accounts.deactivate')"
      :busy="busy"
      testid="roster-deactivate-dialog"
      @update:model-value="(open) => { if (!open) deactivating = null }"
      @confirm="confirmDeactivate"
    />
  </div>
</template>
