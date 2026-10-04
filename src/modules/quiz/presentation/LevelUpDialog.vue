<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePreferredReducedMotion } from '@vueuse/core'
import { useProgressStore } from '@/modules/quiz/application/progressStore'
import TierBadge from '@/modules/quiz/presentation/TierBadge.vue'

const { t } = useI18n()
const store = useProgressStore()
const motion = usePreferredReducedMotion()
const open = computed({
  get: () => store.celebration !== null,
  set: (value: boolean) => {
    if (!value) {
      store.dismissCelebration()
    }
  },
})
const animated = computed(() => motion.value !== 'reduce')
// Fixed positions: the confetti looks the same on every render.
const CONFETTI = Array.from({ length: 18 }, (_, i) => ({ left: `${(i * 37) % 100}%`, delay: `${(i % 6) * 0.12}s`, hue: (i * 47) % 360 }))
</script>

<template>
  <v-dialog
    v-model="open"
    max-width="360"
  >
    <v-card
      v-if="store.celebration"
      class="level-up pa-6 text-center"
      :class="{ 'level-up--animated': animated }"
      data-testid="level-up"
    >
      <div
        v-if="animated"
        class="level-up__confetti"
        aria-hidden="true"
      >
        <span
          v-for="(piece, index) in CONFETTI"
          :key="index"
          :style="{ left: piece.left, animationDelay: piece.delay, backgroundColor: `hsl(${piece.hue} 80% 55%)` }"
        />
      </div>
      <div class="text-overline">
        {{ t('progress.levelUpTitle') }}
      </div>
      <div class="level-up__badge my-4">
        <TierBadge
          :tier="store.celebration"
          :points="store.history?.points ?? 0"
          size="large"
        />
      </div>
      <div class="text-h6">
        {{ t('progress.levelUp', { tier: t(`progress.tier.${store.celebration}`) }) }}
      </div>
      <v-btn
        color="primary"
        class="mt-4"
        data-testid="level-up-close"
        @click="store.dismissCelebration()"
      >
        {{ t('progress.levelUpClose') }}
      </v-btn>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.level-up {
  position: relative;
  overflow: hidden;
}

.level-up--animated .level-up__badge {
  animation: level-up-pop 900ms cubic-bezier(0.2, 1.4, 0.4, 1) both;
}

.level-up__confetti span {
  position: absolute;
  top: -12px;
  width: 8px;
  height: 14px;
  border-radius: 2px;
  animation: level-up-fall 1.6s ease-in forwards;
}

@keyframes level-up-pop {
  from {
    transform: scale(0.2) rotate(-200deg);
    opacity: 0;
  }

  to {
    transform: scale(1) rotate(0);
    opacity: 1;
  }
}

@keyframes level-up-fall {
  to {
    transform: translateY(420px) rotate(540deg);
    opacity: 0;
  }
}
</style>
