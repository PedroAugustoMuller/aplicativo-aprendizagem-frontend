<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { tierLook } from '@/modules/quiz/presentation/tierLook'
import type { Tier } from '@/modules/quiz/domain/Progress'

const props = withDefaults(defineProps<{ tier: Tier; points: number; size?: 'small' | 'large' }>(), { size: 'small' })
const { t } = useI18n()
const look = computed(() => tierLook(props.tier))
const name = computed(() => t(`progress.tier.${props.tier}`))
</script>

<template>
  <v-chip
    v-if="size === 'small'"
    :color="look.color"
    variant="flat"
    size="small"
    :prepend-icon="look.icon"
    data-testid="tier-badge"
    :data-tier="tier"
  >
    {{ t('progress.badge', { tier: name, points }) }}
  </v-chip>
  <div
    v-else
    class="d-flex flex-column align-center"
    data-testid="tier-badge"
    :data-tier="tier"
  >
    <v-avatar
      :color="look.color"
      size="88"
    >
      <v-icon
        :icon="look.icon"
        size="56"
      />
    </v-avatar>
    <div class="text-h5 mt-2">
      {{ name }}
    </div>
    <div class="text-subtitle-1 text-medium-emphasis">
      {{ t('progress.points', { points }) }}
    </div>
  </div>
</template>
