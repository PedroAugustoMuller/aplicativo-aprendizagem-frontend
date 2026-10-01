<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOnline } from '@vueuse/core'
import { useRosterStore } from '@/modules/identity/application/rosterStore'
import { MAX_BATCH, MAX_NAME_LENGTH, parseRoster } from '@/modules/identity/domain/roster'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { ApiError } from '@/shared/api/error'
import OfflineHint from '@/shared/ui/OfflineHint.vue'

const props = defineProps<{ modelValue: boolean; classroomId: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; created: [] }>()

const { t, te } = useI18n()
const store = useRosterStore()
const online = useOnline()

const text = ref('')
const busy = ref(false)
const error = ref<ApiError | null>(null)

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      text.value = ''
      error.value = null
    }
  },
  { immediate: true },
)

const preview = computed(() => parseRoster(text.value))
const tooMany = computed(() => preview.value.names.length > MAX_BATCH)
const valid = computed(() => preview.value.names.length > 0 && preview.value.tooLong.length === 0 && !tooMany.value)
const message = computed(() => (error.value === null ? null : apiErrorMessage(error.value, t, te)))

async function submit(): Promise<void> {
  if (!valid.value || busy.value || !online.value) {
    return
  }

  busy.value = true
  error.value = null

  try {
    // The store keeps each name's id until a batch succeeds, across openings.
    await store.createMany(props.classroomId, store.rowsFor(props.classroomId, preview.value.names))
    emit('update:modelValue', false)
    emit('created')
  } catch (failure: unknown) {
    error.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="560"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card data-testid="roster-add-dialog">
      <v-card-title>{{ t('roster.add') }}</v-card-title>
      <v-card-text>
        <OfflineHint />
        <v-textarea
          v-model="text"
          data-testid="roster-names"
          :label="t('roster.namesLabel')"
          rows="8"
          auto-grow
          autofocus
        />
        <p
          class="mb-2"
          data-testid="roster-preview"
        >
          {{ t('roster.preview', preview.names.length) }}
        </p>
        <v-alert
          v-if="preview.duplicates.length > 0"
          type="info"
          variant="tonal"
          density="compact"
          class="mb-2"
          data-testid="roster-duplicates"
          :text="t('roster.duplicates', { names: preview.duplicates.join(', ') })"
        />
        <v-alert
          v-if="preview.tooLong.length > 0"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-2"
          data-testid="roster-too-long"
          :text="t('roster.tooLong', { max: MAX_NAME_LENGTH, names: preview.tooLong.join(', ') })"
        />
        <v-alert
          v-if="tooMany"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-2"
          data-testid="roster-too-many"
          :text="t('roster.tooMany', { max: MAX_BATCH })"
        />
        <v-alert
          v-if="message"
          type="error"
          variant="tonal"
          data-testid="roster-add-error"
          :text="message"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          data-testid="roster-add-cancel"
          @click="emit('update:modelValue', false)"
        >
          {{ t('common.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          data-testid="roster-submit"
          :loading="busy"
          :disabled="!valid || !online"
          @click.prevent="submit"
        >
          {{ t('roster.submit') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
