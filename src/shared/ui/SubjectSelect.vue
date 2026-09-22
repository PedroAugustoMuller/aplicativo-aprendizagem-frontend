<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSubjectStore } from '@/modules/content/application/subjectStore'

const model = defineModel<string | null>({ required: true })
const store = useSubjectStore()
const { t } = useI18n()

const items = computed(() => store.activeSubjects.map((subject) => ({ title: subject.name, value: subject.id })))

onMounted(() => void store.ensureLoaded())
</script>

<template>
  <!-- data-testid falls through to this single root element via Vue's default attrs inheritance. -->
  <v-select
    v-model="model"
    :items="items"
    :label="t('subjects.subject')"
    :loading="store.loading"
    :no-data-text="t('subjects.empty')"
  />
</template>
