<script setup lang="ts">
import { watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/modules/identity/application/sessionStore'
import { homeFor } from '@/shared/router/guard'

const { t } = useI18n()
const router = useRouter()
const session = useSessionStore()

watchEffect(() => {
  if (session.role !== null) {
    void router.replace(homeFor(session.role))
  }
})

const retry = () => void session.restore()
</script>

<template>
  <div class="d-flex flex-column align-center py-12">
    <v-progress-circular
      v-if="session.restoring"
      indeterminate
      data-testid="home-loading"
    />
    <v-alert
      v-else-if="session.role === null"
      type="warning"
      variant="tonal"
      data-testid="home-offline"
      :text="t('home.profileUnavailable')"
    >
      <template #append>
        <v-btn
          variant="text"
          data-testid="home-retry"
          @click="retry"
        >
          {{ t('common.retry') }}
        </v-btn>
      </template>
    </v-alert>
  </div>
</template>
