<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, onMounted, ref } from 'vue'
import { useOnline } from '@vueuse/core'
import { mdiPencil, mdiPlus, mdiCancel } from '@mdi/js'
import { useViewerRole } from '@/shared/auth/viewer'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import SubjectFormDialog from '@/modules/content/presentation/SubjectFormDialog.vue'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { ApiError } from '@/shared/api/error'
import type { Subject } from '@/modules/content/domain/Subject'
import { useSubjectStore } from '@/modules/content/application/subjectStore'
import ApiErrorAlert from '@/shared/ui/ApiErrorAlert.vue'
import OfflineBanner from '@/shared/ui/OfflineBanner.vue'
import OfflineHint from '@/shared/ui/OfflineHint.vue'

const store = useSubjectStore()
const { t, te } = useI18n()
const role = useViewerRole()
const online = useOnline()
const isAdmin = computed(() => role.value === 'admin')

const formOpen = ref(false)
const editing = ref<Subject | null>(null)
const deactivating = ref<Subject | null>(null)
const busy = ref(false)
const actionError = ref<ApiError | null>(null)
const actionMessage = computed(() => (actionError.value === null ? null : apiErrorMessage(actionError.value, t, te)))

function openForm(subject: Subject | null): void {
  editing.value = subject
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
    deactivating.value = null
  } catch (failure: unknown) {
    actionError.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
    deactivating.value = null
  } finally {
    busy.value = false
  }
}

// Always refetch here: this page is where a newly enrolled subject should appear.
onMounted(() => void store.load())
</script>

<template>
  <div>
    <div class="d-flex align-center flex-wrap ga-2 mb-4">
      <h1 class="text-h5 me-auto">
        {{ t('subjects.title') }}
      </h1>
      <v-btn
        v-if="isAdmin"
        color="primary"
        :prepend-icon="mdiPlus"
        :disabled="!online"
        :title="online ? undefined : t('offline.writeDisabled')"
        data-testid="subjects-create"
        @click="openForm(null)"
      >
        {{ t('subjects.create') }}
      </v-btn>
    </div>

    <v-alert
      v-if="actionMessage"
      type="error"
      variant="tonal"
      closable
      class="mb-4"
      data-testid="subjects-action-error"
      :text="actionMessage"
      @click:close="actionError = null"
    />

    <OfflineBanner :saved-at="store.savedAt" />
    <OfflineHint v-if="isAdmin" />

    <v-progress-linear
      v-if="store.loading"
      indeterminate
      data-testid="subjects-loading"
    />

    <ApiErrorAlert
      v-else-if="store.error"
      :error="store.error"
      testid="subjects"
      @retry="store.load()"
    />

    <v-alert
      v-else-if="store.subjects.length === 0"
      type="info"
      variant="tonal"
      data-testid="subjects-empty"
      :text="t('subjects.empty')"
    />

    <!-- One column on phones, two on tablets, three on desktop. Same component. -->
    <v-row
      v-else
      data-testid="subjects-list"
    >
      <v-col
        v-for="subject in store.subjects"
        :key="subject.id"
        cols="12"
        sm="6"
        md="4"
      >
        <v-card
          :data-testid="`subject-${subject.id}`"
          :to="`/subjects/${subject.id}/topics`"
          class="h-100"
          variant="tonal"
        >
          <v-card-item>
            <v-card-title class="text-wrap">
              {{ subject.name }}
            </v-card-title>
            <template
              v-if="!subject.active"
              #append
            >
              <v-chip
                size="small"
                data-testid="subject-inactive"
              >
                {{ t('subjects.inactive') }}
              </v-chip>
            </template>
          </v-card-item>
        </v-card>
        <div
          v-if="isAdmin"
          class="d-flex ga-1 mt-1"
        >
          <v-btn
            size="small"
            variant="text"
            :prepend-icon="mdiPencil"
            :disabled="!online"
            :data-testid="`subject-rename-${subject.id}`"
            @click="openForm(subject)"
          >
            {{ t('subjects.rename') }}
          </v-btn>
          <v-btn
            v-if="subject.active"
            size="small"
            variant="text"
            color="error"
            :prepend-icon="mdiCancel"
            :disabled="!online"
            :data-testid="`subject-deactivate-${subject.id}`"
            @click="deactivating = subject"
          >
            {{ t('subjects.deactivate') }}
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <SubjectFormDialog
      v-model="formOpen"
      :subject="editing"
    />
    <ConfirmDialog
      :model-value="deactivating !== null"
      :title="t('subjects.deactivateTitle', { name: deactivating?.name ?? '' })"
      :message="t('subjects.deactivateMessage')"
      :confirm-label="t('subjects.deactivate')"
      :busy="busy"
      testid="subject-deactivate-dialog"
      @update:model-value="(open) => { if (!open) deactivating = null }"
      @confirm="confirmDeactivate"
    />
  </div>
</template>
