<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { mdiContentCopy } from '@mdi/js'

// Generic on purpose: Task 7 reuses this for students. No teacher-specific
// wording belongs here.
const props = defineProps<{ name: string; login: string; password: string }>()
const open = defineModel<boolean>('open', { required: true })

const { t } = useI18n()
const copied = ref(false)

watch(open, (isOpen) => {
  if (isOpen) {
    copied.value = false
  }
})

async function copy(): Promise<void> {
  try {
    await globalThis.navigator.clipboard.writeText(props.password)
    copied.value = true
  } catch {
    // Clipboard access can fail (permissions, insecure context); the values
    // stay visible on screen either way, so there is nothing else to do.
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
        {{ t('credentials.title') }}
      </v-card-title>
      <v-card-text>
        <p class="mb-4">
          {{ t('credentials.intro') }}
        </p>
        <div
          class="text-h6 font-weight-medium mb-4"
          data-testid="temporary-password-name"
        >
          {{ name }}
        </div>
        <div class="text-caption text-medium-emphasis">
          {{ t('credentials.login') }}
        </div>
        <div
          class="text-h6 mb-4"
          style="font-family: monospace;"
          data-testid="temporary-password-login"
        >
          {{ login }}
        </div>
        <div class="text-caption text-medium-emphasis">
          {{ t('credentials.password') }}
        </div>
        <div class="d-flex align-center">
          <div
            class="text-h6"
            style="font-family: monospace;"
            data-testid="temporary-password-value"
          >
            {{ password }}
          </div>
          <v-btn
            :icon="mdiContentCopy"
            variant="text"
            :aria-label="t('credentials.copy')"
            data-testid="temporary-password-copy"
            @click="copy"
          />
        </div>
        <div
          v-if="copied"
          class="text-caption text-success"
          data-testid="temporary-password-copied"
        >
          {{ t('credentials.copied') }}
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          data-testid="temporary-password-close"
          variant="text"
          @click="open = false"
        >
          {{ t('credentials.close') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
