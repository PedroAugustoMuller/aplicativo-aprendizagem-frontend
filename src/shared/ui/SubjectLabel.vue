<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useSubjectStore } from '@/modules/content/application/subjectStore'

const props = defineProps<{ subjectId: string; fallback?: string }>()
const store = useSubjectStore()
const name = computed(() => store.nameOf(props.subjectId) ?? props.fallback ?? '—')

onMounted(() => void store.ensureLoaded())
</script>

<template>
  <span>{{ name }}</span>
</template>
