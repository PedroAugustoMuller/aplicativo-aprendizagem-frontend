<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOnline } from '@vueuse/core'
import { useTopicStore } from '@/modules/content/application/topicStore'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { ApiError } from '@/shared/api/error'
import type { Topic } from '@/modules/content/domain/Topic'
import type { TopicPatch } from '@/modules/content/domain/TopicRepository'
import OfflineHint from '@/shared/ui/OfflineHint.vue'

const props = defineProps<{ modelValue: boolean; topic: Topic | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const { t, te } = useI18n()
const store = useTopicStore()
const online = useOnline()

const name = ref('')
const description = ref('')
const busy = ref(false)
const error = ref<ApiError | null>(null)
// One id per opening: a retry after a timeout replays the original create.
let requestId = ''

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      requestId = globalThis.crypto.randomUUID()
      name.value = props.topic?.name ?? ''
      description.value = props.topic?.description ?? ''
      error.value = null
    }
  },
  { immediate: true },
)

const message = computed(() => (error.value === null ? null : apiErrorMessage(error.value, t, te)))
const fieldErrors = (field: string): string[] =>
  (error.value?.fields?.[field] ?? []).map((entry) => apiErrorMessage(new ApiError(entry.code, entry.params), t, te))
const nameErrors = computed(() => fieldErrors('name'))
const descriptionErrors = computed(() => fieldErrors('description'))
const canSave = computed(() => online.value && name.value.trim() !== '' && !busy.value)

async function save(): Promise<void> {
  if (!canSave.value) {
    return
  }

  busy.value = true
  error.value = null
  const input = { name: name.value.trim(), description: description.value.trim() }

  try {
    if (props.topic === null) {
      await store.create(requestId, input)
    } else {
      // Only what this edit changed: sending the untouched fields back would
      // undo someone else's concurrent change to them.
      const patch: TopicPatch = {
        ...(input.name === props.topic.name ? {} : { name: input.name }),
        ...(input.description === props.topic.description ? {} : { description: input.description }),
      }

      if (Object.keys(patch).length > 0) {
        await store.update(props.topic.id, patch)
      }
    }

    emit('update:modelValue', false)
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
    max-width="520"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card data-testid="topic-form">
      <v-card-title>{{ topic === null ? t('topics.create') : t('topics.edit') }}</v-card-title>
      <v-card-text>
        <OfflineHint />
        <v-form @submit.prevent="save">
          <v-text-field
            v-model="name"
            data-testid="topic-form-name"
            :label="t('topics.name')"
            :error-messages="nameErrors"
            maxlength="120"
            counter="120"
            autofocus
          />
          <v-textarea
            v-model="description"
            data-testid="topic-form-description"
            :label="t('topics.description')"
            :error-messages="descriptionErrors"
            maxlength="500"
            counter="500"
            rows="2"
            auto-grow
          />
        </v-form>
        <v-alert
          v-if="message"
          type="error"
          variant="tonal"
          data-testid="topic-form-error"
          :text="message"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="emit('update:modelValue', false)"
        >
          {{ t('common.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          data-testid="topic-form-save"
          :loading="busy"
          :disabled="!canSave"
          @click.prevent="save"
        >
          {{ t('common.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
