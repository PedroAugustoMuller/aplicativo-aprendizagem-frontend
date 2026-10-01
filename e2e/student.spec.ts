// Carla's session, written once by e2e/global-setup.ts. No logins here.
import { expect, test } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/carla.json' })

test('a student sees only the subjects', async ({ page }) => {
  await page.goto('/subjects')
  await expect(page.getByTestId('subjects-list')).toBeVisible()

  await expect(page.locator('a[href="/classrooms"]')).toHaveCount(0)
  await expect(page.locator('a[href="/teachers"]')).toHaveCount(0)

  await page.goto('/classrooms')
  await expect(page).toHaveURL(/\/subjects$/)
})
