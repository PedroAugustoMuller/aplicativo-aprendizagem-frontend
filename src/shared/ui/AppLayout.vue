<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { useEventListener } from '@vueuse/core'
import { mdiLogout, mdiWeatherNight, mdiWeatherSunny } from '@mdi/js'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAppTheme } from '@/shared/theme/useAppTheme'
import { useSessionStore } from '@/modules/identity/application/sessionStore'
import { useSubjectStore } from '@/modules/content/application/subjectStore'
import { useTopicStore } from '@/modules/content/application/topicStore'
import { useQuestionStore } from '@/modules/content/application/questionStore'
import { useTeacherStore } from '@/modules/identity/application/teacherStore'
import { useClassroomStore } from '@/modules/identity/application/classroomStore'
import { useRosterStore } from '@/modules/identity/application/rosterStore'
import { useQuizStore } from '@/modules/quiz/application/quizStore'
import PendingAnswersChip from '@/modules/quiz/presentation/PendingAnswersChip.vue'
import { clearOfflineData } from '@/shared/offline/readThrough'
import { navItemsFor } from '@/shared/ui/navigation'

const { mobile } = useDisplay()
const { t } = useI18n()
const router = useRouter()
const session = useSessionStore()
const { isDark, setMode } = useAppTheme()

// The remembered role keeps the right menu after an offline reload.
const items = computed(() =>
  navItemsFor(session.knownUser?.role ?? null).map((item) => ({
    title: t(`nav.${item.key}`),
    icon: item.icon,
    to: item.to,
  })),
)

// While a temporary password is pending every other page is a 403; offer none.
const showNav = computed(() => session.hasSession && !session.mustChangePassword)

const subjects = useSubjectStore()
const topics = useTopicStore()
const questions = useQuestionStore()
const teachers = useTeacherStore()
const classrooms = useClassroomStore()
const roster = useRosterStore()
const quiz = useQuizStore()

// Sign-out and an expired token both end here: the next person on this phone
// must not see (or briefly flash) the previous session's content.
watch(
  () => session.hasSession,
  (hasSession) => {
    if (!hasSession) {
      subjects.reset()
      topics.reset()
      questions.reset()
      teachers.reset()
      classrooms.reset()
      roster.reset()
      // In memory only: the device copy of unsent answers survives an expired session.
      quiz.reset()
    }
  },
)

// The previous user's saved lists leave this phone with their session.
watch(
  () => session.knownUser?.userId ?? null,
  (current, previous) => {
    if (previous !== null && previous !== current) {
      void clearOfflineData(previous)
    }
  },
)

// Unsent answers go out whenever a session is (re)established and whenever the
// connection comes back; the queue itself survives an expired session.
watch(
  () => session.hasSession,
  (hasSession) => {
    if (hasSession) {
      void quiz.sync()
    }
  },
  { immediate: true },
)
useEventListener(globalThis, 'online', () => {
  if (session.hasSession) {
    void quiz.sync()
  }
})

const toggleTheme = () => setMode(isDark.value ? 'light' : 'dark')

const unsentOnSignOut = ref(0)
const signingOut = ref(false)

async function finishSignOut(): Promise<void> {
  unsentOnSignOut.value = 0
  // Everything was sent, or the user chose to drop it: this phone keeps nothing of theirs.
  await quiz.discardDeviceData()
  await session.logout()
  await router.push('/login')
}

async function signOut(): Promise<void> {
  if (signingOut.value) {
    return
  }

  signingOut.value = true

  try {
    const unsent = await quiz.pendingBeforeSignOut()

    if (unsent > 0) {
      unsentOnSignOut.value = unsent

      return
    }

    await finishSignOut()
  } finally {
    signingOut.value = false
  }
}
</script>

<template>
  <v-app>
    <v-app-bar
      :elevation="1"
      density="comfortable"
    >
      <v-app-bar-title>{{ t('app.name') }}</v-app-bar-title>
      <v-spacer />
      <PendingAnswersChip v-if="session.hasSession" />
      <v-btn
        :icon="isDark ? mdiWeatherSunny : mdiWeatherNight"
        :aria-label="t('nav.theme')"
        data-testid="theme-toggle"
        @click="toggleTheme"
      />
      <v-btn
        v-if="session.hasSession"
        :icon="mdiLogout"
        :aria-label="t('nav.signOut')"
        :loading="signingOut"
        data-testid="sign-out"
        @click="signOut"
      />
    </v-app-bar>

    <!-- Desktop: a persistent rail. Phones: nothing here; navigation sits at the bottom. -->
    <v-navigation-drawer
      v-if="!mobile && showNav"
      permanent
      rail
    >
      <v-list nav>
        <v-list-item
          v-for="item in items"
          :key="item.to"
          :to="item.to"
          :prepend-icon="item.icon"
        />
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <v-container
        :fluid="mobile"
        class="py-6"
      >
        <slot />
      </v-container>
    </v-main>

    <v-bottom-navigation
      v-if="mobile && showNav"
      grow
    >
      <v-btn
        v-for="item in items"
        :key="item.to"
        :to="item.to"
      >
        <v-icon :icon="item.icon" />
        <span>{{ item.title }}</span>
      </v-btn>
    </v-bottom-navigation>
    <v-dialog
      :model-value="unsentOnSignOut > 0"
      max-width="420"
      @update:model-value="(open) => { if (!open) unsentOnSignOut = 0 }"
    >
      <v-card data-testid="sign-out-pending">
        <v-card-title class="text-wrap">
          {{ t('quiz.signOutPendingTitle') }}
        </v-card-title>
        <v-card-text>{{ t('quiz.signOutPendingMessage', unsentOnSignOut) }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            data-testid="sign-out-pending-stay"
            @click="unsentOnSignOut = 0"
          >
            {{ t('quiz.stay') }}
          </v-btn>
          <v-btn
            color="error"
            variant="flat"
            data-testid="sign-out-pending-confirm"
            @click="finishSignOut"
          >
            {{ t('quiz.signOutAnyway') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-app>
</template>
