<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOnline } from '@vueuse/core'
import { mdiAccountCheck, mdiAccountOff, mdiLockReset, mdiPlus } from '@mdi/js'
import { useTeacherStore } from '@/modules/identity/application/teacherStore'
import TeacherFormDialog from '@/modules/identity/presentation/TeacherFormDialog.vue'
import TemporaryPasswordDialog from '@/modules/identity/presentation/TemporaryPasswordDialog.vue'
import ApiErrorAlert from '@/shared/ui/ApiErrorAlert.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import OfflineBanner from '@/shared/ui/OfflineBanner.vue'
import OfflineHint from '@/shared/ui/OfflineHint.vue'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { ApiError } from '@/shared/api/error'
import type { IssuedAccount } from '@/modules/identity/domain/IssuedAccount'
import type { Teacher } from '@/modules/identity/domain/Teacher'

const { t, te } = useI18n()
const store = useTeacherStore()
const online = useOnline()

const formOpen = ref(false)
const issued = ref<IssuedAccount | null>(null)
const resetting = ref<Teacher | null>(null)
const deactivating = ref<Teacher | null>(null)
const busy = ref(false)
const actionError = ref<ApiError | null>(null)
const actionMessage = computed(() => (actionError.value === null ? null : apiErrorMessage(actionError.value, t, te)))

onMounted(() => void store.load())

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
    deactivating.value = null
  }
}

const confirmReset = (): Promise<void> =>
  run(async () => {
    if (resetting.value !== null) {
      issued.value = await store.resetPassword(resetting.value.id)
    }
  })

const confirmDeactivate = (): Promise<void> =>
  run(async () => {
    if (deactivating.value !== null) {
      await store.setActive(deactivating.value.id, false)
    }
  })

function toggle(teacher: Teacher): void {
  if (teacher.active) {
    deactivating.value = teacher
  } else {
    void run(() => store.setActive(teacher.id, true))
  }
}
</script>

<template>
  <div>
    <div class="d-flex align-center flex-wrap ga-2 mb-4">
      <h1 class="text-h5 me-auto">
        {{ t('teachers.title') }}
      </h1>
      <v-btn
        color="primary"
        :prepend-icon="mdiPlus"
        :disabled="!online"
        :title="online ? undefined : t('offline.writeDisabled')"
        data-testid="teachers-create"
        @click="formOpen = true"
      >
        {{ t('teachers.create') }}
      </v-btn>
    </div>

    <OfflineBanner :saved-at="store.savedAt" />
    <OfflineHint />

    <v-alert
      v-if="actionMessage"
      type="error"
      variant="tonal"
      closable
      class="mb-4"
      data-testid="teachers-action-error"
      :text="actionMessage"
      @click:close="actionError = null"
    />

    <v-progress-linear
      v-if="store.loading"
      indeterminate
      data-testid="teachers-loading"
    />

    <ApiErrorAlert
      v-else-if="store.error"
      :error="store.error"
      testid="teachers"
      @retry="store.load()"
    />

    <v-alert
      v-else-if="store.teachers.length === 0"
      type="info"
      variant="tonal"
      data-testid="teachers-empty"
      :text="t('teachers.empty')"
    />

    <v-list
      v-else
      lines="two"
      data-testid="teachers-list"
    >
      <v-list-item
        v-for="teacher in store.teachers"
        :key="teacher.id"
        :data-testid="`teacher-${teacher.id}`"
        :title="teacher.name"
        :subtitle="teacher.email"
      >
        <template #append>
          <v-chip
            v-if="!teacher.active"
            size="small"
            class="me-2"
          >
            {{ t('accounts.inactive') }}
          </v-chip>
          <v-chip
            v-else-if="teacher.mustChangePassword"
            size="small"
            color="warning"
            class="me-2"
          >
            {{ t('accounts.pendingPassword') }}
          </v-chip>
          <v-btn
            :icon="mdiLockReset"
            variant="text"
            :disabled="!online || !teacher.active"
            :aria-label="t('accounts.resetPassword')"
            :title="t('accounts.resetPassword')"
            :data-testid="`teacher-reset-${teacher.id}`"
            @click="resetting = teacher"
          />
          <v-btn
            :icon="teacher.active ? mdiAccountOff : mdiAccountCheck"
            variant="text"
            :disabled="!online"
            :aria-label="teacher.active ? t('accounts.deactivate') : t('accounts.reactivate')"
            :title="teacher.active ? t('accounts.deactivate') : t('accounts.reactivate')"
            :data-testid="`teacher-toggle-${teacher.id}`"
            @click="toggle(teacher)"
          />
        </template>
      </v-list-item>
    </v-list>

    <TeacherFormDialog
      v-model="formOpen"
      @created="(account) => (issued = account)"
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
      testid="teacher-reset-dialog"
      @update:model-value="(open) => { if (!open) resetting = null }"
      @confirm="confirmReset"
    />
    <ConfirmDialog
      :model-value="deactivating !== null"
      :title="t('accounts.deactivateTitle', { name: deactivating?.name ?? '' })"
      :message="t('accounts.deactivateMessage')"
      :confirm-label="t('accounts.deactivate')"
      :busy="busy"
      testid="teacher-deactivate-dialog"
      @update:model-value="(open) => { if (!open) deactivating = null }"
      @confirm="confirmDeactivate"
    />
  </div>
</template>
