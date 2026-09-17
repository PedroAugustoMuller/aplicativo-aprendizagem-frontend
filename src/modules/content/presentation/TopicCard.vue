<script setup lang="ts">
import type { Topic } from '@/modules/content/domain/Topic'

defineProps<{ topic: Topic }>()
</script>

<template>
  <v-card
    :data-testid="`topic-${topic.id}`"
    class="h-100"
    variant="tonal"
  >
    <v-card-item>
      <v-card-title class="text-wrap">
        {{ topic.name }}
      </v-card-title>
    </v-card-item>
    <v-card-text>{{ topic.description }}</v-card-text>
  </v-card>
</template>
