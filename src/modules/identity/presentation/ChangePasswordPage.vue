<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/modules/identity/application/sessionStore'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { ApiError } from '@/shared/api/error'
import { homeFor } from '@/shared/router/guard'

const MIN_LENGTH = 8

const { t, te } = useI18n()
const router = useRouter()
const session = useSessionStore()

// Captured on open: after a successful change the flag flips, but the notice
// should not vanish mid-submit.
const forced = session.mustChangePassword

const current = ref('')
const next = ref('')
const confirm = ref('')
const submitting = ref(false)
const error = ref<ApiError | null>(null)
const errorMessage = computed(() => (error.value === null ? null : apiErrorMessage(error.value, t, te)))

const tooShort = computed(() => next.value.length > 0 && next.value.length < MIN_LENGTH)
const mismatch = computed(() => confirm.value.length > 0 && confirm.value !== next.value)
const canSubmit = computed(
  () => current.value !== '' && next.value.length >= MIN_LENGTH && confirm.value === next.value && !submitting.value,
)

async function submit(): Promise<void> {
  if (!canSubmit.value) {
    return
  }
  submitting.value = true
  error.value = null
  try {
    await session.changePassword({ currentPassword: current.value, newPassword: next.value })
    await router.replace(session.role === null ? '/' : homeFor(session.role))
  } catch (failure: unknown) {
    error.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <v-row justify="center">
    <v-col
      cols="12"
      sm="8"
      md="5"
      lg="4"
    >
      <v-card>
        <v-card-title class="text-h5">
          {{ t('password.title') }}
        </v-card-title>
        <v-card-text>
          <v-alert
            v-if="forced"
            data-testid="password-forced-notice"
            type="info"
            variant="tonal"
            class="mb-4"
            :text="t('password.forced')"
          />
          <v-form @submit.prevent="submit">
            <v-text-field
              v-model="current"
              data-testid="password-current"
              :label="forced ? t('password.temporary') : t('password.current')"
              type="password"
              autocomplete="current-password"
            />
            <v-text-field
              v-model="next"
              data-testid="password-new"
              :label="t('password.new')"
              type="password"
              autocomplete="new-password"
              :error-messages="tooShort ? [t('password.tooShort', { min: MIN_LENGTH })] : []"
            />
            <v-text-field
              v-model="confirm"
              data-testid="password-confirm"
              :label="t('password.confirm')"
              type="password"
              autocomplete="new-password"
              :error-messages="mismatch ? [t('password.mismatch')] : []"
            />
            <v-alert
              v-if="errorMessage"
              data-testid="password-error"
              type="error"
              variant="tonal"
              class="mb-4"
              :text="errorMessage"
            />
            <!-- .prevent on @click: same double-submit reason as LoginPage. -->
            <v-btn
              data-testid="password-submit"
              type="submit"
              color="primary"
              block
              size="large"
              :disabled="!canSubmit"
              :loading="submitting"
              @click.prevent="submit"
            >
              {{ t('password.submit') }}
            </v-btn>
          </v-form>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>
