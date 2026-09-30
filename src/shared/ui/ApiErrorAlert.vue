<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import type { ApiError } from '@/shared/api/error'

const props = defineProps<{ error: ApiError; testid: string }>()
const emit = defineEmits<{ retry: [] }>()

const { t, te } = useI18n()
const route = useRoute()

const message = computed(() => apiErrorMessage(props.error, t, te))
// The guard cannot know about a pending change after an offline cold start, and
// retrying repeats the same 403: give the student the way out the message asks for.
const needsPasswordChange = computed(() => props.error.code === 'identity.password_change_required')
</script>

<template>
  <v-alert
    type="error"
    variant="tonal"
    :data-testid="`${testid}-error`"
    class="mb-4"
  >
    {{ message }}
    <template #append>
      <v-btn
        v-if="needsPasswordChange"
        variant="text"
        :data-testid="`${testid}-change-password`"
        :to="{ path: '/change-password', query: { redirect: route.fullPath } }"
      >
        {{ t('password.title') }}
      </v-btn>
      <v-btn
        variant="text"
        :data-testid="`${testid}-retry`"
        @click="emit('retry')"
      >
        {{ t('common.retry') }}
      </v-btn>
    </template>
  </v-alert>
</template>
