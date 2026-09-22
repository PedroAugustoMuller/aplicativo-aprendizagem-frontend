import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    storageState: 'e2e/.auth/admin.json',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // build:e2e (see vite.config.ts) leaves the PWA service worker out of this
    // build: a real one would call skipWaiting()+clientsClaim() on its first
    // install and could claim a page mid-test.
    command: 'npm run build:e2e && npm run preview',
    url: 'http://localhost:5173',
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
