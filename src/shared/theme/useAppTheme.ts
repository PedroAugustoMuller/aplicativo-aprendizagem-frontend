import { computed, watch } from 'vue'
import { usePreferredDark, useStorage } from '@vueuse/core'
import { useTheme } from 'vuetify'

export type ThemeMode = 'system' | 'light' | 'dark'

/** Pure and therefore directly testable — no Vuetify, no browser. */
export const resolveThemeName = (mode: ThemeMode, prefersDark: boolean): 'light' | 'dark' =>
  mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode

export function useAppTheme() {
  const theme = useTheme()
  const prefersDark = usePreferredDark()
  const mode = useStorage<ThemeMode>('quimica.theme', 'system')

  const themeName = computed(() => resolveThemeName(mode.value, prefersDark.value))

  // Confirmed against node_modules/vuetify/lib/composables/theme.d.ts (Vuetify 4.2.1):
  // ThemeInstance.change(themeName: string, transition?): Promise<void> is a real method.
  watch(themeName, (name) => theme.change(name), { immediate: true })

  return {
    mode,
    isDark: computed(() => themeName.value === 'dark'),
    setMode: (next: ThemeMode) => {
      mode.value = next
    },
  }
}
