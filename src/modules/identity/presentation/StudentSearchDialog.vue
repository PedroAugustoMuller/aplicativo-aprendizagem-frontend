<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDebounceFn, useOnline } from '@vueuse/core'
import { useRosterStore, type EnrolResult } from '@/modules/identity/application/rosterStore'
import { apiErrorMessage } from '@/shared/i18n/apiErrorMessage'
import { ApiError } from '@/shared/api/error'
import type { StudentMatch } from '@/modules/identity/domain/Student'
import OfflineHint from '@/shared/ui/OfflineHint.vue'

const props = defineProps<{ modelValue: boolean; classroomId: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; enrolled: [] }>()

const MIN_LENGTH = 2

const { t, te } = useI18n()
const store = useRosterStore()
const online = useOnline()

const text = ref('')
const results = ref<StudentMatch[]>([])
const searching = ref(false)
const searchError = ref<ApiError | null>(null)
const selected = ref<string[]>([])
const failures = ref<EnrolResult[]>([])
const busy = ref(false)
// Only the newest search may show its answer.
let latest = 0

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      text.value = ''
      results.value = []
      selected.value = []
      failures.value = []
      searchError.value = null
    }
  },
  { immediate: true },
)

const runSearch = useDebounceFn(async (value: string): Promise<void> => {
  const request = ++latest
  const query = value.trim()

  if (query.length < MIN_LENGTH) {
    results.value = []
    return
  }

  searching.value = true
  searchError.value = null

  try {
    const found = await store.search(query)

    if (request === latest) {
      results.value = found
    }
  } catch (failure: unknown) {
    if (request === latest) {
      searchError.value = failure instanceof ApiError ? failure : new ApiError('system.unexpected_error')
    }
  } finally {
    if (request === latest) {
      searching.value = false
    }
  }
}, 300)

watch(text, (value) => void runSearch(value))

const tooShort = computed(() => text.value.trim().length < MIN_LENGTH)
const searchMessage = computed(() => (searchError.value === null ? null : apiErrorMessage(searchError.value, t, te)))
const alreadyIn = (match: StudentMatch): boolean => match.classrooms.some((classroom) => classroom.id === props.classroomId)
const failedNames = computed(() =>
  failures.value
    .map((failure) => results.value.find((match) => match.id === failure.studentId)?.name ?? failure.studentId)
    .join(', '),
)

function setChecked(id: string, checked: boolean): void {
  selected.value = checked ? [...selected.value, id] : selected.value.filter((value) => value !== id)
}

async function submit(): Promise<void> {
  if (selected.value.length === 0 || busy.value || !online.value) {
    return
  }

  busy.value = true

  try {
    const outcome = await store.enrolMany(props.classroomId, selected.value)
    failures.value = outcome.filter((result) => result.error !== null)

    if (failures.value.length === 0) {
      emit('enrolled')
      emit('update:modelValue', false)
    } else {
      // Keep only the failed ones ticked, ready for another try.
      selected.value = failures.value.map((failure) => failure.studentId)
    }
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
    <v-card data-testid="student-search">
      <v-card-title>{{ t('search.title') }}</v-card-title>
      <v-card-text>
        <OfflineHint />
        <v-text-field
          v-model="text"
          data-testid="student-search-input"
          :label="t('search.label')"
          :loading="searching"
          autocapitalize="off"
          autocorrect="off"
          autofocus
        />
        <p
          v-if="tooShort"
          class="text-medium-emphasis"
          data-testid="student-search-hint"
        >
          {{ t('search.hint') }}
        </p>
        <v-alert
          v-else-if="searchMessage"
          type="error"
          variant="tonal"
          :text="searchMessage"
        />
        <p
          v-else-if="!searching && results.length === 0"
          class="text-medium-emphasis"
        >
          {{ t('search.none') }}
        </p>
        <v-list
          v-else
          density="compact"
        >
          <v-list-item
            v-for="match in results"
            :key="match.id"
            :data-testid="`student-match-${match.id}`"
            :title="match.name"
            :subtitle="[match.username, ...match.classrooms.map((classroom) => classroom.name)].join(' · ')"
          >
            <template #prepend>
              <v-checkbox-btn
                :model-value="selected.includes(match.id)"
                :disabled="alreadyIn(match)"
                :data-testid="`student-check-${match.id}`"
                @update:model-value="(checked) => setChecked(match.id, checked === true)"
              />
            </template>
            <template
              v-if="alreadyIn(match)"
              #append
            >
              <v-chip size="small">
                {{ t('search.alreadyIn') }}
              </v-chip>
            </template>
          </v-list-item>
        </v-list>
        <v-alert
          v-if="failures.length > 0"
          type="error"
          variant="tonal"
          class="mt-2"
          data-testid="student-search-failures"
          :text="t('search.failures', { names: failedNames })"
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
          data-testid="student-search-submit"
          :loading="busy"
          :disabled="selected.length === 0 || !online"
          @click.prevent="submit"
        >
          {{ t('search.submit', { count: selected.length }) }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
