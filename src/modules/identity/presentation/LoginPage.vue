<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/modules/identity/application/sessionStore'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { ApiError } from '@/shared/api/error'

const { t, te } = useI18n()
const router = useRouter()
const route = useRoute()
const session = useSessionStore()

const email = ref('')
const password = ref('')
const submitting = ref(false)
// Hold the ApiError, not its translation, so a language change re-renders it.
const error = ref<ApiError | null>(null)
const errorMessage = computed(() => (error.value === null ? null : apiErrorMessage(error.value, t, te)))

async function submit(): Promise<void> {
  submitting.value = true
  error.value = null

  try {
    await session.login({ email: email.value, password: password.value })

    const redirect = route.query.redirect
    await router.push(typeof redirect === 'string' ? redirect : '/topics')
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
          {{ t('auth.title') }}
        </v-card-title>

        <v-card-text>
          <v-alert
            v-if="route.query.reason === 'expired'"
            data-testid="login-expired"
            type="info"
            variant="tonal"
            class="mb-4"
            :text="t('auth.signedOut')"
          />

          <v-form @submit.prevent="submit">
            <v-text-field
              v-model="email"
              data-testid="login-email"
              :label="t('auth.email')"
              type="email"
              autocomplete="email"
              autofocus
            />
            <v-text-field
              v-model="password"
              data-testid="login-password"
              :label="t('auth.password')"
              type="password"
              autocomplete="current-password"
            />

            <v-alert
              v-if="errorMessage"
              data-testid="login-error"
              type="error"
              variant="tonal"
              class="mb-4"
              :text="errorMessage"
            />

            <!-- .prevent on @click is load-bearing: without it, clicking the button triggers both
              the click handler AND the form's native submit event on the form, causing a double POST
              in a real browser. Unit tests cannot catch this (happy-dom does not implement native form
              submission from button clicks); the end-to-end suite verifies it. -->
            <v-btn
              data-testid="login-submit"
              type="submit"
              color="primary"
              block
              size="large"
              :loading="submitting"
              @click.prevent="submit"
            >
              {{ t('auth.submit') }}
            </v-btn>
          </v-form>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>
