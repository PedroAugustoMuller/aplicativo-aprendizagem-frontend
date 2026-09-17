import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Química 9º Ano',
        short_name: 'Química',
        description: 'Quiz de química para o 9º ano do Ensino Fundamental',
        lang: 'pt-BR',
        theme_color: '#00695C',
        background_color: '#FFFFFF',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2}'],
        // API responses are deliberately NOT cached here. Offline quiz content is
        // RNF03 and belongs with the quiz feature, where the caching policy can be
        // designed against a real payload instead of guessed at now.
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173 },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.spec.ts'],
    setupFiles: ['./vitest.setup.ts'],
    server: {
      // Vuetify's ESM build emits `.css` side-effect imports. Without this,
      // vite-node treats vuetify as an external Node module and hands those
      // imports straight to Node's loader, which cannot parse CSS.
      deps: { inline: ['vuetify'] },
    },
  },
})
