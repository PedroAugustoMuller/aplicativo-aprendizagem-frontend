<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useDisplay } from 'vuetify'
import { useI18n } from 'vue-i18n'
import { mdiCancel, mdiPencil, mdiPlus } from '@mdi/js'
import { useSubjectStore } from '@/modules/content/application/subjectStore'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { canRetry as canRetryError } from '@/shared/api/canRetry'
import { ApiError } from '@/shared/api/error'
import SubjectFormDialog from '@/modules/content/presentation/SubjectFormDialog.vue'
import type { Subject } from '@/modules/content/domain/Subject'

const { t, te } = useI18n()
const { mobile } = useDisplay()
const store = useSubjectStore()

const errorMessage = computed(() => (store.error === null ? null : apiErrorMessage(store.error, t, te)))
const canRetry = computed(() => canRetryError(store.error))

const showFormDialog = ref(false)
const editingSubject = ref<Subject | null>(null)

const showConfirmDialog = ref(false)
const confirmingSubject = ref<Subject | null>(null)
const deactivating = ref(false)
const confirmError = ref<ApiError | null>(null)
const confirmErrorMessage = computed(() => (confirmError.value === null ? null : apiErrorMessage(confirmError.value, t, te)))

function openCreate(): void {
  editingSubject.value = null
  showFormDialog.value = true
}

function openRename(subject: Subject): void {
  editingSubject.value = subject
  showFormDialog.value = true
}

function openDeactivateConfirm(subject: Subject): void {
  confirmingSubject.value = subject
  confirmError.value = null
  showConfirmDialog.value = true
}

async function confirmDeactivate(): Promise<void> {
  if (confirmingSubject.value === null) {
    return
  }

  deactivating.value = true
  confirmError.value = null

  try {
    await store.deactivate(confirmingSubject.value.id)
    showConfirmDialog.value = false
  } catch (failure: unknown) {
    confirmError.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
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
        {{ t('subjects.title') }}
      </h1>
      <v-btn
        data-testid="subjects-create"
        color="primary"
        :prepend-icon="mdiPlus"
        @click="openCreate"
      >
        {{ t('subjects.create') }}
      </v-btn>
    </div>

    <v-progress-linear
      v-if="store.loading"
      indeterminate
      data-testid="subjects-loading"
    />

    <v-alert
      v-else-if="errorMessage"
      type="error"
      variant="tonal"
      data-testid="subjects-error"
      class="mb-4"
    >
      {{ errorMessage }}
      <template
        v-if="canRetry"
        #append
      >
        <v-btn
          variant="text"
          data-testid="subjects-retry"
          @click="store.load()"
        >
          {{ t('common.retry') }}
        </v-btn>
      </template>
    </v-alert>

    <v-alert
      v-else-if="store.subjects.length === 0"
      type="info"
      variant="tonal"
      data-testid="subjects-empty"
      :text="t('subjects.empty')"
    />

    <v-list
      v-else
      data-testid="subjects-list"
    >
      <v-list-item
        v-for="subject in store.subjects"
        :key="subject.id"
        :data-testid="`subject-row-${subject.id}`"
        :title="subject.name"
      >
        <template #append>
          <v-chip
            v-if="!subject.active"
            :text="t('subjects.inactive')"
            size="small"
            class="mr-2"
          />
          <v-btn
            :data-testid="`subject-rename-${subject.id}`"
            :icon="mobile ? mdiPencil : undefined"
            :prepend-icon="mobile ? undefined : mdiPencil"
            :aria-label="t('subjects.rename')"
            variant="text"
            @click="openRename(subject)"
          >
            <template v-if="!mobile">
              {{ t('subjects.rename') }}
            </template>
          </v-btn>
          <v-btn
            v-if="subject.active"
            :data-testid="`subject-deactivate-${subject.id}`"
            :icon="mobile ? mdiCancel : undefined"
            :prepend-icon="mobile ? undefined : mdiCancel"
            :aria-label="t('subjects.deactivate')"
            variant="text"
            @click="openDeactivateConfirm(subject)"
          >
            <template v-if="!mobile">
              {{ t('subjects.deactivate') }}
            </template>
          </v-btn>
        </template>
      </v-list-item>
    </v-list>

    <SubjectFormDialog
      v-model:open="showFormDialog"
      :subject="editingSubject"
    />

    <v-dialog
      v-model="showConfirmDialog"
      max-width="480"
    >
      <v-card>
        <v-card-title>{{ t('subjects.deactivate') }}</v-card-title>
        <v-card-text>
          {{ confirmingSubject === null ? '' : t('subjects.deactivateConfirm', { name: confirmingSubject.name }) }}
          <v-alert
            v-if="confirmErrorMessage"
            data-testid="subject-deactivate-error"
            type="error"
            variant="tonal"
            class="mt-4"
            :text="confirmErrorMessage"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showConfirmDialog = false"
          >
            {{ t('common.cancel') }}
          </v-btn>
          <v-btn
            data-testid="subject-deactivate-confirm"
            color="primary"
            :loading="deactivating"
            @click="confirmDeactivate"
          >
            {{ t('subjects.deactivate') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
