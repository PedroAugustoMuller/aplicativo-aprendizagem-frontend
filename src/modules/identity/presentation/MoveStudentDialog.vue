<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useClassroomStore } from '@/modules/identity/application/classroomStore'
import { useRosterStore } from '@/modules/identity/application/rosterStore'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { ApiError } from '@/shared/api/error'
import type { AccountSummary } from '@/modules/identity/domain/Account'

const props = defineProps<{ student: AccountSummary | null }>()
const open = defineModel<boolean>('open', { required: true })

const { t, te } = useI18n()
const classroomStore = useClassroomStore()
const roster = useRosterStore()

const targetId = ref<string | null>(null)
const moving = ref(false)
const error = ref<ApiError | null>(null)

const errorMessage = computed(() => (error.value === null ? null : apiErrorMessage(error.value, t, te)))
// Only the actor's OTHER active classrooms are valid targets: GET /classrooms
// already scopes the list to what the signed-in teacher or admin may enrol
// into, and the current classroom is excluded because moving there is a no-op.
const items = computed(() =>
  classroomStore.classrooms
    .filter((classroom) => classroom.active && classroom.id !== roster.classroomId)
    .map((classroom) => ({ title: classroom.name, value: classroom.id })),
)

watch(open, (isOpen) => {
  if (isOpen) {
    targetId.value = null
    error.value = null
    if (classroomStore.classrooms.length === 0) {
      void classroomStore.load()
    }
  }
})

async function submit(): Promise<void> {
  if (props.student === null || targetId.value === null || moving.value) {
    return
  }

  moving.value = true
  error.value = null

  try {
    await roster.moveTo(props.student.id, targetId.value)
    open.value = false
  } catch (failure: unknown) {
    error.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
  } finally {
    moving.value = false
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
        {{ t('roster.move') }}
      </v-card-title>
      <v-card-text>
        <v-select
          v-model="targetId"
          data-testid="move-target-select"
          :items="items"
          :loading="classroomStore.loading"
          :label="t('roster.moveTarget')"
        />
        <v-alert
          v-if="errorMessage"
          data-testid="move-error"
          type="error"
          variant="tonal"
          class="mt-4"
          :text="errorMessage"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          data-testid="move-cancel"
          variant="text"
          @click="open = false"
        >
          {{ t('common.cancel') }}
        </v-btn>
        <v-btn
          data-testid="move-submit"
          color="primary"
          :disabled="targetId === null"
          :loading="moving"
          @click.prevent="submit"
        >
          {{ t('roster.move') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
