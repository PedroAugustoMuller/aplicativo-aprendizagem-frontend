<script setup lang="ts">
import { computed } from 'vue'
import { useDisplay } from 'vuetify'
import { mdiAccountCircle, mdiLockReset, mdiLogout, mdiWeatherNight, mdiWeatherSunny } from '@mdi/js'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAppTheme } from '@/shared/theme/useAppTheme'
import { useSessionStore } from '@/modules/identity/application/sessionStore'
import { navigationFor } from '@/shared/ui/navigation'
import { resetSharedStores } from '@/shared/ui/resetStores'

const { mobile } = useDisplay()
const { t } = useI18n()
const router = useRouter()
const session = useSessionStore()
const { isDark, setMode } = useAppTheme()

const items = computed(() => navigationFor(session.role))

const toggleTheme = () => setMode(isDark.value ? 'light' : 'dark')

async function signOut(): Promise<void> {
  await session.logout()
  // A second user signing in on the same shared phone must not see the
  // previous user's cached lists.
  resetSharedStores()
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
      <v-menu v-if="session.hasSession">
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            :icon="mdiAccountCircle"
            :aria-label="t('nav.account')"
            data-testid="account-menu"
          />
        </template>
        <v-list>
          <v-list-item
            :title="t('nav.changePassword')"
            :prepend-icon="mdiLockReset"
            to="/change-password"
            data-testid="menu-change-password"
          />
          <v-list-item
            :title="t('nav.signOut')"
            :prepend-icon="mdiLogout"
            data-testid="sign-out"
            @click="signOut"
          />
        </v-list>
      </v-menu>
    </v-app-bar>

    <!-- Desktop: a persistent, labelled drawer. Phones: nothing here; navigation sits at the bottom. -->
    <v-navigation-drawer
      v-if="!mobile && session.hasSession && !session.mustChangePassword"
      permanent
    >
      <v-list nav>
        <v-list-item
          v-for="item in items"
          :key="item.to"
          :to="item.to"
          :prepend-icon="item.icon"
          :title="t(item.titleKey)"
          :data-testid="item.testId"
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
      v-if="items.length > 0 && mobile && session.hasSession && !session.mustChangePassword"
      grow
    >
      <v-btn
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        :data-testid="item.testId"
      >
        <v-icon :icon="item.icon" />
        <span>{{ t(item.titleKey) }}</span>
      </v-btn>
    </v-bottom-navigation>
  </v-app>
</template>

<style>
/* Not scoped: the chrome this hides (app bar, drawer, bottom nav) is here in
   AppLayout, but the print trigger lives on the page inside <slot /> (see
   CredentialSlipsPage.vue), so a scoped style could not reach it either way. */
@media print {
  .v-app-bar,
  .v-navigation-drawer,
  .v-bottom-navigation {
    display: none !important;
  }

  .v-main {
    padding: 0 !important;
  }
}
</style>
