<script setup lang="ts">
import { computed } from 'vue'
import { useDisplay } from 'vuetify'
import { mdiFlaskOutline, mdiLogout, mdiWeatherNight, mdiWeatherSunny } from '@mdi/js'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAppTheme } from '@/shared/theme/useAppTheme'
import { useSessionStore } from '@/modules/identity/application/sessionStore'

const { mobile } = useDisplay()
const { t } = useI18n()
const router = useRouter()
const session = useSessionStore()
const { isDark, setMode } = useAppTheme()

const items = computed(() => [{ title: t('nav.topics'), icon: mdiFlaskOutline, to: '/topics' }])

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
      v-if="!mobile && session.hasSession"
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
      v-if="mobile && session.hasSession"
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
