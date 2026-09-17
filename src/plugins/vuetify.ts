import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'

export const vuetify = createVuetify({
  // SVG icons, not the class-based default: the default `mdi` set needs the whole
  // @mdi/font webfont, which this app never ships. Components pass path constants
  // imported from @mdi/js (tree-shaken per icon), and mdi-svg's aliases give
  // Vuetify's internal icons (alerts, selects, ...) inline `svg:` paths too.
  icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        dark: false,
        colors: { primary: '#00695C', secondary: '#4DB6AC', surface: '#FFFFFF', error: '#B3261E' },
      },
      dark: {
        dark: true,
        colors: { primary: '#4DB6AC', secondary: '#80CBC4', surface: '#121212', error: '#F2B8B5' },
      },
    },
  },
  defaults: {
    VBtn: { variant: 'flat' },
    VTextField: { variant: 'outlined', density: 'comfortable' },
  },
})
