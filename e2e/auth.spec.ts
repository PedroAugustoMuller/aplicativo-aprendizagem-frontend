// Login budget for this whole run: the backend throttles POST /auth/login to
// 5 attempts/minute per email+IP. e2e/global-setup.ts spends 1 attempt to build
// the shared session every other spec reuses. Of the tests in this file, only
// "a teacher signs in..." (both projects) and "a wrong password..." (desktop
// only) submit the login form. No other test anywhere in this suite may call
// the login form or the login API.
// Total per run: 1 (setup) + 2 (journey, desktop + mobile) + 1 (wrong password,
// desktop only) = 4 attempts/minute, at or under the limit of 5.
// The two login-issuing tests below run with retries disabled: a retry spends
// another login attempt, and a genuine failure that trips the throttle would
// return 429, which a retry would then treat as another failure to retry -
// cascading past the budget instead of just failing once.
import { expect, test } from '@playwright/test'

const TEACHER = { email: 'ana@escola.br', password: 'password' }

test.describe('without a session', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('an anonymous visitor is sent to login', async ({ page }) => {
    await page.goto('/topics')

    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('without a session, login-issuing tests', () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  test.describe.configure({ retries: 0 })

  test('a teacher signs in with exactly one request and can sign out', async ({ page }) => {
    let loginPostCount = 0
    await page.route('**/api/v1/auth/login', async (route) => {
      if (route.request().method() === 'POST') {
        loginPostCount += 1
      }
      await route.continue()
    })

    await page.goto('/login')
    await page.getByTestId('login-email').locator('input').fill(TEACHER.email)
    await page.getByTestId('login-password').locator('input').fill(TEACHER.password)
    await page.getByTestId('login-submit').click()

    await expect(page).toHaveURL(/\/topics/)
    await expect(page.getByTestId('topics-list')).toBeVisible()
    // The submit button uses @click.prevent - without it, a click also fires the
    // form's native submit, sending the login request twice. happy-dom (unit
    // tests) does not simulate native form submission from a button click, so
    // only a real browser can catch a regression here.
    expect(loginPostCount).toBe(1)

    await page.getByTestId('sign-out').click()
    await expect(page).toHaveURL(/\/login/)

    await page.goto('/topics')
    await expect(page).toHaveURL(/\/login/)
  })

  test('a wrong password shows the translated message, not a code', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop',
      'login throttle budget: this login attempt only runs once, on desktop - see the budget comment at the top of this file',
    )

    await page.goto('/login')
    await page.getByTestId('login-email').locator('input').fill(TEACHER.email)
    await page.getByTestId('login-password').locator('input').fill('definitely-wrong')
    await page.getByTestId('login-submit').click()

    const error = page.getByTestId('login-error')
    await expect(error).toBeVisible()
    await expect(error).toHaveText('E-mail ou senha incorretos.')
    await expect(error).not.toContainText('identity.invalid_credentials')
    // A wrong password is a 401 on a request without a token - an answer, not an
    // expired session. The transport must not sign out/redirect with reason=expired.
    await expect(page.getByTestId('login-expired')).toHaveCount(0)
    expect(new URL(page.url()).searchParams.get('reason')).toBeNull()
  })
})

test.describe('with the shared session', () => {
  test('an expired token sends the user back to login without touching the shared session', async ({
    page,
  }) => {
    // storageState is loaded into this test's own browser context at context
    // creation time; overwriting localStorage here only affects this context's
    // copy, never the e2e/.auth/teacher.json file other tests still rely on.
    await page.goto('/topics')
    await expect(page.getByTestId('topics-list')).toBeVisible()

    await page.evaluate(() => window.localStorage.setItem('quimica.auth.token', 'no-longer-valid'))
    await page.reload()

    await expect(page).toHaveURL(/\/login/)
    // restore() got the 401, so the guard (the only navigation on first load)
    // carries both the expiry notice and the way back.
    const url = new URL(page.url())
    expect(url.searchParams.get('reason')).toBe('expired')
    expect(url.searchParams.get('redirect')).toBe('/topics')
    await expect(page.getByTestId('login-expired')).toHaveText('Sua sessão expirou. Entre novamente.')
  })
})
