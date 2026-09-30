<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/modules/identity/application/sessionStore'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { ApiError } from '@/shared/api/error'

// Mirrors the backend rule (ChangePasswordRequest: min:8). The server still decides.
const MIN_LENGTH = 8

const { t, te } = useI18n()
const router = useRouter()
const route = useRoute()
const session = useSessionStore()

const current = ref('')
const next = ref('')
const confirmation = ref('')
const submitting = ref(false)
// Client-side messages appear only after the first attempt, not while typing.
const attempted = ref(false)
// Hold the ApiError, not its translation, so a language change re-renders it.
const error = ref<ApiError | null>(null)

const errorMessage = computed(() => (error.value === null ? null : apiErrorMessage(error.value, t, te)))

const serverMessages = (field: string): string[] =>
  (error.value?.fields?.[field] ?? []).map((entry) =>
    apiErrorMessage(new ApiError(entry.code, entry.params), t, te),
  )

const tooShort = computed(() => next.value.length < MIN_LENGTH)
const mismatch = computed(() => confirmation.value !== next.value)

const currentMessages = computed(() => serverMessages('current_password'))
const nextMessages = computed(() => [
  ...(attempted.value && tooShort.value ? [t('password.tooShort', { min: MIN_LENGTH })] : []),
  ...serverMessages('new_password'),
])
const confirmMessages = computed(() => (attempted.value && mismatch.value ? [t('password.mismatch')] : []))

async function submit(): Promise<void> {
  // A double tap on a slow connection must not send two changes.
  if (submitting.value) {
    return
  }

  attempted.value = true
  error.value = null

  if (tooShort.value || mismatch.value) {
    return
  }

  submitting.value = true

  try {
    await session.changePassword({ currentPassword: current.value, newPassword: next.value })

    const redirect = route.query.redirect
    await router.push(typeof redirect === 'string' ? redirect : '/subjects')
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
            v-if="session.mustChangePassword"
            data-testid="password-required"
            type="info"
            variant="tonal"
            class="mb-4"
            :text="t('password.required')"
          />

          <v-form @submit.prevent="submit">
            <v-text-field
              v-model="current"
              data-testid="password-current"
              :label="t('password.current')"
              type="password"
              autocomplete="current-password"
              :error-messages="currentMessages"
              autofocus
            />
            <v-text-field
              v-model="next"
              data-testid="password-new"
              :label="t('password.new')"
              type="password"
              autocomplete="new-password"
              :error-messages="nextMessages"
            />
            <v-text-field
              v-model="confirmation"
              data-testid="password-confirm"
              :label="t('password.confirm')"
              type="password"
              autocomplete="new-password"
              :error-messages="confirmMessages"
            />

            <v-alert
              v-if="errorMessage"
              data-testid="password-error"
              type="error"
              variant="tonal"
              class="mb-4"
              :text="errorMessage"
            />

            <!-- .prevent is load-bearing, as on LoginPage: without it a click also
              fires the form's native submit. submit() also ignores re-entry. -->
            <v-btn
              data-testid="password-submit"
              type="submit"
              color="primary"
              block
              size="large"
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
