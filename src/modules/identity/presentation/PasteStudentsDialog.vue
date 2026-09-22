<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { mdiPrinter } from '@mdi/js'
import { useRosterStore } from '@/modules/identity/application/rosterStore'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { ApiError } from '@/shared/api/error'
import { newId } from '@/shared/id/newId'
import { MAX_STUDENTS_PER_BATCH, nameKey, parseNameList } from '@/modules/identity/domain/nameList'
import type { AccountDetail } from '@/modules/identity/domain/Account'

const props = defineProps<{ classroomId: string }>()
const open = defineModel<boolean>('open', { required: true })

const { t, te } = useI18n()
const roster = useRosterStore()

const text = ref('')
const submitting = ref(false)
const error = ref<ApiError | null>(null)
const created = ref<AccountDetail[] | null>(null)

// Minted per parsed name the first time it appears in the OPEN dialog, then
// kept: editing the textarea keeps ids for names that remain, and a retry
// after a failed submit resends the identical rows. Cleared the next time the
// dialog opens.
// Deliberately a plain (non-reactive) Map: `rows` (below) calls idFor(), which
// writes into it, from inside a computed getter. A reactive Map would make
// that write trigger Vue's dependency tracking mid-computation and could
// re-invoke the getter (or trip Vue's "computed being mutated" warning); a
// plain Map is a silent, ordinary side effect that Vue never observes.
let ids = new Map<string, string>()

function idFor(name: string): string {
  const key = nameKey(name)
  let id = ids.get(key)
  if (id === undefined) {
    id = newId()
    ids.set(key, id)
  }
  return id
}

const parsed = computed(() => parseNameList(text.value))
const rows = computed(() => parsed.value.names.map((name) => ({ id: idFor(name), name })))
const errorMessage = computed(() => (error.value === null ? null : apiErrorMessage(error.value, t, te)))
const duplicatesMessage = computed(() => t('roster.duplicates', { names: parsed.value.duplicates.join(', ') }))
const canSubmit = computed(() => parsed.value.names.length > 0 && !parsed.value.overLimit && !submitting.value)

watch(open, (isOpen) => {
  if (isOpen) {
    text.value = ''
    error.value = null
    created.value = null
    submitting.value = false
    ids = new Map()
  }
})

async function submit(): Promise<void> {
  if (!canSubmit.value) {
    return
  }

  submitting.value = true
  error.value = null

  try {
    created.value = await roster.createMany(rows.value)
  } catch (failure: unknown) {
    error.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
  } finally {
    submitting.value = false
  }
}

function close(): void {
  open.value = false
}
</script>

<template>
  <v-dialog
    v-model="open"
    max-width="640"
  >
    <v-card>
      <v-card-title>
        {{ t('roster.add') }}
      </v-card-title>
      <v-card-text>
        <template v-if="created === null">
          <v-textarea
            v-model="text"
            data-testid="paste-textarea"
            rows="10"
            :placeholder="t('roster.pastePlaceholder')"
            :disabled="submitting"
          />
          <div data-testid="paste-preview">
            <p class="mb-2">
              {{ t('roster.previewCount', { count: parsed.names.length }, parsed.names.length) }}
            </p>
            <v-chip
              v-for="row in rows"
              :key="row.id"
              class="mr-1 mb-1"
              :text="row.name"
            />
          </div>
          <v-alert
            v-if="parsed.duplicates.length > 0"
            data-testid="paste-duplicates"
            type="warning"
            variant="tonal"
            class="mt-2"
            :text="duplicatesMessage"
          />
          <v-alert
            v-if="parsed.overLimit"
            data-testid="paste-over-limit"
            type="error"
            variant="tonal"
            class="mt-2"
            :text="t('roster.overLimit', { max: MAX_STUDENTS_PER_BATCH })"
          />
          <v-alert
            v-if="errorMessage"
            data-testid="paste-error"
            type="error"
            variant="tonal"
            class="mt-2"
            :text="errorMessage"
          />
        </template>
        <template v-else>
          <div data-testid="paste-result">
            <p class="mb-2">
              {{ t('roster.created') }}
            </p>
            <v-list>
              <v-list-item
                v-for="student in created"
                :key="student.id"
                :title="student.name"
              >
                <template #subtitle>
                  <span style="font-family: monospace;">{{ student.login }} · {{ student.temporaryPassword }}</span>
                </template>
              </v-list-item>
            </v-list>
          </div>
        </template>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <template v-if="created === null">
          <v-btn
            data-testid="paste-cancel"
            variant="text"
            @click="close"
          >
            {{ t('common.cancel') }}
          </v-btn>
          <v-btn
            data-testid="paste-submit"
            color="primary"
            :disabled="!canSubmit"
            :loading="submitting"
            @click.prevent="submit"
          >
            {{ t('roster.create') }}
          </v-btn>
        </template>
        <template v-else>
          <v-btn
            data-testid="paste-print-slips"
            variant="text"
            color="primary"
            :prepend-icon="mdiPrinter"
            :to="`/classrooms/${props.classroomId}/credentials`"
          >
            {{ t('roster.printSlips') }}
          </v-btn>
          <v-btn
            data-testid="paste-close"
            variant="text"
            @click="close"
          >
            {{ t('credentials.close') }}
          </v-btn>
        </template>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
