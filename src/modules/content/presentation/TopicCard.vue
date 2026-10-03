<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { mdiArrowDown, mdiArrowUp, mdiCancel, mdiPencil, mdiRestore } from '@mdi/js'
import type { Topic } from '@/modules/content/domain/Topic'

defineProps<{
  topic: Topic
  subjectId: string
  canAuthor: boolean
  first: boolean
  last: boolean
  /** Offline or busy: every change button greys out. */
  locked: boolean
}>()
const emit = defineEmits<{ edit: []; toggle: []; move: [direction: -1 | 1] }>()

const { t } = useI18n()
</script>

<template>
  <div class="h-100 d-flex flex-column">
    <!-- Buttons stay outside the card: a card with `to` is a link, and a button inside a link is invalid. -->
    <v-card
      :data-testid="`topic-${topic.id}`"
      :to="canAuthor ? `/subjects/${subjectId}/topics/${topic.id}/questions` : undefined"
      class="flex-grow-1"
      variant="tonal"
    >
      <v-card-item>
        <v-card-title class="text-wrap">
          {{ topic.name }}
        </v-card-title>
        <template
          v-if="!topic.active"
          #append
        >
          <v-chip
            size="small"
            data-testid="topic-inactive"
          >
            {{ t('topics.inactive') }}
          </v-chip>
        </template>
      </v-card-item>
      <v-card-text>
        {{ topic.description }}
        <div
          v-if="topic.questionCount !== null"
          class="mt-2 text-medium-emphasis"
          data-testid="topic-question-count"
        >
          {{ t('topics.questionCount', topic.questionCount) }}
        </div>
      </v-card-text>
    </v-card>
    <div
      v-if="canAuthor"
      class="d-flex flex-wrap align-center ga-1 mt-1"
    >
      <v-btn
        size="small"
        variant="text"
        :prepend-icon="mdiPencil"
        :disabled="locked"
        :data-testid="`topic-edit-${topic.id}`"
        @click="emit('edit')"
      >
        {{ t('topics.edit') }}
      </v-btn>
      <v-btn
        icon
        size="small"
        variant="text"
        :disabled="locked || first"
        :aria-label="t('topics.moveUp')"
        :title="t('topics.moveUp')"
        :data-testid="`topic-up-${topic.id}`"
        @click="emit('move', -1)"
      >
        <v-icon :icon="mdiArrowUp" />
      </v-btn>
      <v-btn
        icon
        size="small"
        variant="text"
        :disabled="locked || last"
        :aria-label="t('topics.moveDown')"
        :title="t('topics.moveDown')"
        :data-testid="`topic-down-${topic.id}`"
        @click="emit('move', 1)"
      >
        <v-icon :icon="mdiArrowDown" />
      </v-btn>
      <v-btn
        size="small"
        variant="text"
        :color="topic.active ? 'error' : undefined"
        :prepend-icon="topic.active ? mdiCancel : mdiRestore"
        :disabled="locked"
        :data-testid="`topic-toggle-${topic.id}`"
        @click="emit('toggle')"
      >
        {{ topic.active ? t('topics.deactivate') : t('topics.reactivate') }}
      </v-btn>
    </div>
  </div>
</template>
