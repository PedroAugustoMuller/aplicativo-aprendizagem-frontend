// These tests use the shared session written by e2e/global-setup.ts (the
// default storageState in playwright.config.ts). None of them sign in - see
// the login budget comment at the top of e2e/auth.spec.ts.
import { expect, test } from '@playwright/test'
import { CHEMISTRY_ID } from './support/api.ts'

test.describe('topics', () => {
  test('the seeded chemistry syllabus is listed in order', async ({ page }) => {
    await page.goto(`/subjects/${CHEMISTRY_ID}/topics`)

    await expect(page.getByTestId('topics-list')).toBeVisible()

    const titles = await page.locator('[data-testid^="topic-"] .v-card-title').allTextContents()
    expect(titles.length).toBeGreaterThanOrEqual(6)
    expect(titles[0]?.trim()).toBe('Matéria e suas Transformações')
  })

  test('a failing request shows a translated error and retry recovers', async ({ page }) => {
    await page.route('**/api/v1/subjects/*/topics', (route) => route.abort('failed'))

    await page.goto(`/subjects/${CHEMISTRY_ID}/topics`)

    const error = page.getByTestId('topics-error')
    await expect(error).toBeVisible()
    await expect(error).toContainText('Sem conexão com a internet. Verifique sua rede e tente de novo.')
    await expect(error).not.toContainText('api.network_unavailable')

    // Network back: retry must actually reload, not just be visible.
    await page.unroute('**/api/v1/subjects/*/topics')
    await page.getByTestId('topics-retry').click()

    await expect(page.getByTestId('topics-list')).toBeVisible()
    await expect(error).toHaveCount(0)
  })

  test('the theme toggle switches the applied theme and survives a reload', async ({ page }) => {
    await page.goto('/classrooms')
    await expect(page.getByTestId('classrooms-list')).toBeVisible()

    // Icons are inline SVG paths (mdi-svg + @mdi/js). A blank icon - no set
    // configured, or a font class with no font shipped - has no <path d>.
    await expect(page.getByTestId('theme-toggle').locator('svg path')).toHaveAttribute('d', /^M/)

    // Assert the theme Vuetify actually applies (the v-theme--* class on the app
    // root), not just the stored preference - a broken watcher still writes the key.
    const app = page.locator('.v-application')
    const startsDark = /\bv-theme--dark\b/.test((await app.getAttribute('class')) ?? '')
    const toggled = startsDark ? 'light' : 'dark'

    await page.getByTestId('theme-toggle').click()
    await expect(app).toHaveClass(new RegExp(`\\bv-theme--${toggled}\\b`))
    expect(await page.evaluate(() => window.localStorage.getItem('quimica.theme'))).toBe(toggled)

    await page.reload()

    await expect(page.getByTestId('classrooms-list')).toBeVisible()
    await expect(app).toHaveClass(new RegExp(`\\bv-theme--${toggled}\\b`))
  })

  test('navigation layout matches the viewport', async ({ page }, testInfo) => {
    await page.goto(`/subjects/${CHEMISTRY_ID}/topics`)
    await expect(page.getByTestId('topics-list')).toBeVisible()

    if (testInfo.project.name === 'desktop') {
      await expect(page.locator('.v-navigation-drawer')).toBeVisible()
      await expect(page.locator('.v-bottom-navigation')).toHaveCount(0)
    } else {
      await expect(page.locator('.v-bottom-navigation')).toBeVisible()
      await expect(page.locator('.v-navigation-drawer')).toHaveCount(0)
    }
  })
})
