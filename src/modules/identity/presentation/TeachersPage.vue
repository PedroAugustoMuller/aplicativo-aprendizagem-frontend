<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useDisplay } from 'vuetify'
import { useI18n } from 'vue-i18n'
import { mdiCancel, mdiLockReset, mdiPlus, mdiRestore } from '@mdi/js'
import { useTeacherStore } from '@/modules/identity/application/teacherStore'
import { useSessionStore } from '@/modules/identity/application/sessionStore'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { canRetry as canRetryError } from '@/shared/api/canRetry'
import { ApiError } from '@/shared/api/error'
import TeacherFormDialog from '@/modules/identity/presentation/TeacherFormDialog.vue'
import TemporaryPasswordDialog from '@/modules/identity/presentation/TemporaryPasswordDialog.vue'
import type { AccountDetail, AccountSummary } from '@/modules/identity/domain/Account'

const { t, te } = useI18n()
const { mobile } = useDisplay()
const store = useTeacherStore()
const session = useSessionStore()

const errorMessage = computed(() => (store.error === null ? null : apiErrorMessage(store.error, t, te)))
const canRetry = computed(() => canRetryError(store.error))

const showFormDialog = ref(false)

const showCredentials = ref(false)
const credentials = ref<{ name: string; login: string; password: string } | null>(null)

const showResetConfirm = ref(false)
const resetTarget = ref<AccountSummary | null>(null)
const resetting = ref(false)
const resetError = ref<ApiError | null>(null)
const resetErrorMessage = computed(() => (resetError.value === null ? null : apiErrorMessage(resetError.value, t, te)))

const showToggleConfirm = ref(false)
const toggleTarget = ref<AccountSummary | null>(null)
const toggling = ref(false)
const toggleError = ref<ApiError | null>(null)
const toggleErrorMessage = computed(() => (toggleError.value === null ? null : apiErrorMessage(toggleError.value, t, te)))

function isSelf(teacher: AccountSummary): boolean {
  return teacher.id === session.user?.userId
}

function showTemporaryPassword(detail: AccountDetail): void {
  credentials.value = { name: detail.name, login: detail.login, password: detail.temporaryPassword ?? '' }
  showCredentials.value = true
}

function openCreate(): void {
  showFormDialog.value = true
}

function onCreated(detail: AccountDetail): void {
  showTemporaryPassword(detail)
}

function openResetConfirm(teacher: AccountSummary): void {
  resetTarget.value = teacher
  resetError.value = null
  showResetConfirm.value = true
}

async function confirmReset(): Promise<void> {
  if (resetTarget.value === null) {
    return
  }

  resetting.value = true
  resetError.value = null

  try {
    const detail = await store.resetPassword(resetTarget.value.id)
    showResetConfirm.value = false
    showTemporaryPassword(detail)
  } catch (failure: unknown) {
    resetError.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
  } finally {
    resetting.value = false
  }
}

function openToggleConfirm(teacher: AccountSummary): void {
  toggleTarget.value = teacher
  toggleError.value = null
  showToggleConfirm.value = true
}

async function confirmToggle(): Promise<void> {
  if (toggleTarget.value === null) {
    return
  }

  toggling.value = true
  toggleError.value = null

  try {
    await store.setActive(toggleTarget.value.id, !toggleTarget.value.active)
    showToggleConfirm.value = false
  } catch (failure: unknown) {
    toggleError.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
  } finally {
    toggling.value = false
  }
}

onMounted(() => void store.load())
</script>

<template>
  <div>
    <div class="d-flex align-center justify-space-between mb-4">
      <h1 class="text-h5">
        {{ t('teachers.title') }}
      </h1>
      <v-btn
        data-testid="teachers-create"
        color="primary"
        :prepend-icon="mdiPlus"
        @click="openCreate"
      >
        {{ t('teachers.create') }}
      </v-btn>
    </div>

    <v-progress-linear
      v-if="store.loading"
      indeterminate
      data-testid="teachers-loading"
    />

    <v-alert
      v-else-if="errorMessage"
      type="error"
      variant="tonal"
      data-testid="teachers-error"
      class="mb-4"
    >
      {{ errorMessage }}
      <template
        v-if="canRetry"
        #append
      >
        <v-btn
          variant="text"
          data-testid="teachers-retry"
          @click="store.load()"
        >
          {{ t('common.retry') }}
        </v-btn>
      </template>
    </v-alert>

    <v-alert
      v-else-if="store.teachers.length === 0"
      type="info"
      variant="tonal"
      data-testid="teachers-empty"
      :text="t('teachers.empty')"
    />

    <v-list
      v-else
      data-testid="teachers-list"
    >
      <v-list-item
        v-for="teacher in store.teachers"
        :key="teacher.id"
        :data-testid="`teacher-row-${teacher.id}`"
        :title="teacher.name"
        :subtitle="teacher.login"
      >
        <template #append>
          <v-chip
            v-if="teacher.mustChangePassword"
            :text="t('teachers.pendingPassword')"
            size="small"
            class="mr-2"
          />
          <v-chip
            v-if="!teacher.active"
            :text="t('teachers.inactive')"
            size="small"
            class="mr-2"
          />
          <v-btn
            v-if="!isSelf(teacher)"
            :data-testid="`teacher-reset-${teacher.id}`"
            :icon="mobile ? mdiLockReset : undefined"
            :prepend-icon="mobile ? undefined : mdiLockReset"
            :aria-label="t('teachers.resetPassword')"
            variant="text"
            @click="openResetConfirm(teacher)"
          >
            <template v-if="!mobile">
              {{ t('teachers.resetPassword') }}
            </template>
          </v-btn>
          <v-btn
            v-if="!isSelf(teacher)"
            :data-testid="`teacher-toggle-${teacher.id}`"
            :icon="mobile ? (teacher.active ? mdiCancel : mdiRestore) : undefined"
            :prepend-icon="mobile ? undefined : (teacher.active ? mdiCancel : mdiRestore)"
            :aria-label="t(teacher.active ? 'teachers.deactivate' : 'teachers.reactivate')"
            variant="text"
            @click="openToggleConfirm(teacher)"
          >
            <template v-if="!mobile">
              {{ t(teacher.active ? 'teachers.deactivate' : 'teachers.reactivate') }}
            </template>
          </v-btn>
        </template>
      </v-list-item>
    </v-list>

    <TeacherFormDialog
      v-model:open="showFormDialog"
      @created="onCreated"
    />

    <TemporaryPasswordDialog
      v-model:open="showCredentials"
      :name="credentials?.name ?? ''"
      :login="credentials?.login ?? ''"
      :password="credentials?.password ?? ''"
    />

    <v-dialog
      v-model="showResetConfirm"
      max-width="480"
    >
      <v-card>
        <v-card-title>{{ t('teachers.resetPassword') }}</v-card-title>
        <v-card-text>
          {{ resetTarget === null ? '' : t('teachers.resetConfirm', { name: resetTarget.name }) }}
          <v-alert
            v-if="resetErrorMessage"
            data-testid="teacher-reset-error"
            type="error"
            variant="tonal"
            class="mt-4"
            :text="resetErrorMessage"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showResetConfirm = false"
          >
            {{ t('common.cancel') }}
          </v-btn>
          <v-btn
            data-testid="teacher-reset-confirm"
            color="primary"
            :loading="resetting"
            @click="confirmReset"
          >
            {{ t('teachers.resetPassword') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="showToggleConfirm"
      max-width="480"
    >
      <v-card>
        <v-card-title>
          {{ toggleTarget === null ? '' : t(toggleTarget.active ? 'teachers.deactivate' : 'teachers.reactivate') }}
        </v-card-title>
        <v-card-text>
          <template v-if="toggleTarget !== null && toggleTarget.active">
            {{ t('teachers.deactivateConfirm', { name: toggleTarget.name }) }}
          </template>
          <v-alert
            v-if="toggleErrorMessage"
            data-testid="teacher-toggle-error"
            type="error"
            variant="tonal"
            class="mt-4"
            :text="toggleErrorMessage"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showToggleConfirm = false"
          >
            {{ t('common.cancel') }}
          </v-btn>
          <v-btn
            data-testid="teacher-toggle-confirm"
            color="primary"
            :loading="toggling"
            @click="confirmToggle"
          >
            {{ toggleTarget === null ? '' : t(toggleTarget.active ? 'teachers.deactivate' : 'teachers.reactivate') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
