// diego.souza starts every run with a fresh temporary password: e2e/global-setup.ts
// resets it through the admin API and writes it to e2e/.auth/diego.json.
// Login budget: one attempt per run, on desktop only, in diego.souza's own
// throttle bucket (the backend keys it by login+IP) - Ana's budget is untouched.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const DIEGO_FILE = fileURLToPath(new URL('./.auth/diego.json', import.meta.url))

async function readDiego(): Promise<{ login: string; password: string }> {
  const body: unknown = JSON.parse(await readFile(DIEGO_FILE, 'utf8'))

  if (
    typeof body !== 'object' || body === null ||
    !('login' in body) || typeof body.login !== 'string' ||
    !('password' in body) || typeof body.password !== 'string'
  ) {
    throw new Error('e2e/.auth/diego.json is malformed; re-run the suite so global setup rewrites it.')
  }

  return { login: body.login, password: body.password }
}

test.use({ storageState: { cookies: [], origins: [] } })
test.describe.configure({ retries: 0 })

test('a student with a temporary password must replace it before anything else', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop',
    'login throttle budget: this login runs once, on desktop - see the comment at the top of this file',
  )

  const diego = await readDiego()
  const newPassword = `nova-senha-${Date.now()}`

  await page.goto('/login')
  await page.getByTestId('login-identifier').locator('input').fill(diego.login)
  await page.getByTestId('login-password').locator('input').fill(diego.password)
  await page.getByTestId('login-submit').click()

  await expect(page).toHaveURL(/\/change-password/)
  await expect(page.getByTestId('password-required')).toBeVisible()
  await expect(page.locator('.v-navigation-drawer')).toHaveCount(0)

  // A reload elsewhere learns the requirement from /auth/me and bounces back.
  await page.goto('/subjects')
  // vue-router leaves "/" unencoded in query values; accept either form.
  await expect(page).toHaveURL(/\/change-password\?redirect=(%2F|\/)subjects/)

  await page.getByTestId('password-current').locator('input').fill(diego.password)
  await page.getByTestId('password-new').locator('input').fill(newPassword)
  await page.getByTestId('password-confirm').locator('input').fill(newPassword)
  await page.getByTestId('password-submit').click()

  await expect(page).toHaveURL(/\/subjects$/)
  await expect(page.getByTestId('subjects-list')).toContainText('Química')
})
