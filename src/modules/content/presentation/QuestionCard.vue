<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { mdiCheckCircle, mdiCircleOutline } from '@mdi/js'
import type { Question } from '@/modules/content/domain/Question'

defineProps<{ question: Question }>()

const { t } = useI18n()
</script>

<template>
  <v-card
    :data-testid="`question-${question.id}`"
    class="h-100"
    variant="tonal"
  >
    <v-card-item>
      <div class="d-flex flex-wrap ga-2 mb-2">
        <v-chip
          size="small"
          :data-testid="`question-type-${question.id}`"
        >
          {{ t(`questions.types.${question.type}`) }}
        </v-chip>
        <v-chip
          v-if="!question.active"
          size="small"
          data-testid="question-inactive"
        >
          {{ t('questions.inactive') }}
        </v-chip>
      </div>
      <v-card-title class="text-wrap text-body-1 font-weight-medium">
        {{ question.statement }}
      </v-card-title>
    </v-card-item>
    <v-card-text>
      <!-- The answer is marked by icon, weight and a word, never by colour alone (RNF06). -->
      <v-list
        density="compact"
        bg-color="transparent"
      >
        <v-list-item
          v-for="option in question.options"
          :key="option.id"
          :data-testid="option.correct ? 'question-correct' : undefined"
          :prepend-icon="option.correct ? mdiCheckCircle : mdiCircleOutline"
          :class="{ 'font-weight-bold': option.correct }"
        >
          <v-list-item-title class="text-wrap">
            {{ option.text }}
          </v-list-item-title>
          <template
            v-if="option.correct"
            #append
          >
            <v-chip
              size="x-small"
              color="success"
              variant="flat"
            >
              {{ t('questions.correct') }}
            </v-chip>
          </template>
        </v-list-item>
      </v-list>
      <p
        v-if="question.explanation"
        class="mt-2 text-medium-emphasis"
        data-testid="question-explanation"
      >
        {{ t('questions.explanation', { text: question.explanation }) }}
      </p>
    </v-card-text>
  </v-card>
</template>
