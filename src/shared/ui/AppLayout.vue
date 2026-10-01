<script setup lang="ts">
import { computed, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { mdiBookOpenVariant, mdiLogout, mdiWeatherNight, mdiWeatherSunny } from '@mdi/js'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAppTheme } from '@/shared/theme/useAppTheme'
import { useSessionStore } from '@/modules/identity/application/sessionStore'
import { useSubjectStore } from '@/modules/content/application/subjectStore'
import { useTopicStore } from '@/modules/content/application/topicStore'
import { clearOfflineData } from '@/shared/offline/readThrough'

const { mobile } = useDisplay()
const { t } = useI18n()
const router = useRouter()
const session = useSessionStore()
const { isDark, setMode } = useAppTheme()

const items = computed(() => [{ title: t('nav.subjects'), icon: mdiBookOpenVariant, to: '/subjects' }])

// While a temporary password is pending every other page is a 403; offer none.
const showNav = computed(() => session.hasSession && !session.mustChangePassword)

const subjects = useSubjectStore()
const topics = useTopicStore()

// Sign-out and an expired token both end here: the next person on this phone
// must not see (or briefly flash) the previous session's content.
watch(
  () => session.hasSession,
  (hasSession) => {
    if (!hasSession) {
      subjects.reset()
      topics.reset()
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

const toggleTheme = () => setMode(isDark.value ? 'light' : 'dark')

async function signOut(): Promise<void> {
  await session.logout()
  await router.push('/login')
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
  </v-app>
</template>
