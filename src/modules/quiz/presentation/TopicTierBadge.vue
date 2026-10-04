<script setup lang="ts">
import { computed } from 'vue'
import { useProgressStore } from '@/modules/quiz/application/progressStore'
import { useViewerRole } from '@/shared/auth/viewer'
import TierBadge from '@/modules/quiz/presentation/TierBadge.vue'

const props = defineProps<{ topicId: string; subjectId: string }>()
const store = useProgressStore()
const role = useViewerRole()
// A topic without answers has no entry: it is iron at 0.
const entry = computed(() => store.subjectTiers[props.topicId] ?? null)
</script>

<template>
  <router-link
    v-if="role === 'student'"
    :to="`/subjects/${subjectId}/topics/${topicId}/progress`"
    class="d-inline-block mt-1 text-decoration-none"
    :data-testid="`topic-tier-${topicId}`"
  >
    <TierBadge
      :tier="entry?.tier ?? 'iron'"
      :points="entry?.points ?? 0"
    />
  </router-link>
</template>
