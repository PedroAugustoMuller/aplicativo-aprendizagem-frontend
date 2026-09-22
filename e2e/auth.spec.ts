// Login budget: the backend throttles POST /auth/login to 5 attempts/minute per
// login+IP (a different username is a different bucket). The shared admin
// (ana@escola.br) is spent by: global-setup (1) + "an admin signs in" (desktop +
// mobile, 2) + "a wrong password" (desktop only, 1) = 4 of 5. No other test may
// log in as the shared admin. Tests that need another signed-in user create that
// user through the admin API (e2e/support/api.ts) and log in as it - each such
// user has its own bucket and signs in at most twice per project.
// Login-issuing tests run with retries disabled (see the note below).
import { expect, test, type Page } from '@playwright/test'
import { ADMIN } from './support/api.ts'

// Fills the login form and asserts both fields actually hold what was typed
// before returning. This exists because of a flake the controller hit: a
// login test once got a 422 validation.failed instead of the expected 401,
// meaning the browser submitted an empty identifier - the fields had been
// cleared between fill() and click(). The build under test serves a real
// production bundle (see playwright.config.ts's webServer), and the
// suspected cause was the PWA service worker taking control of the page on
// its first install (registerType 'autoUpdate' calls skipWaiting() and
// clientsClaim() immediately) and forcing a reload; that build now never
// registers a service worker at all (see vite.config.ts's `e2e` mode). This
// assertion is kept regardless, so any future regression - from the service
// worker or anything else that clears the form - fails right here with an
// unambiguous message, instead of resurfacing three lines later as the wrong
// error code.
async function fillLoginForm(page: Page, login: string, password: string): Promise<void> {
  const identifier = page.getByTestId('login-identifier').locator('input')
  const passwordField = page.getByTestId('login-password').locator('input')

  await identifier.fill(login)
  await passwordField.fill(password)

  await expect(identifier).toHaveValue(login)
  await expect(passwordField).toHaveValue(password)
}

test.describe('without a session', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('an anonymous visitor is sent to login', async ({ page }) => {
    await page.goto('/classrooms')

    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('without a session, login-issuing tests', () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  test.describe.configure({ retries: 0 })

  test('an admin signs in with exactly one request and can sign out', async ({ page }) => {
    let loginPostCount = 0
    await page.route('**/api/v1/auth/login', async (route) => {
      if (route.request().method() === 'POST') {
        loginPostCount += 1
      }
      await route.continue()
    })

    await page.goto('/login')
    await fillLoginForm(page, ADMIN.login, ADMIN.password)
    await page.getByTestId('login-submit').click()

    await expect(page).toHaveURL(/\/classrooms/)
    await expect(page.getByTestId('classrooms-list')).toBeVisible()
    // The submit button uses @click.prevent - without it, a click also fires the
    // form's native submit, sending the login request twice. happy-dom (unit
    // tests) does not simulate native form submission from a button click, so
    // only a real browser can catch a regression here.
    expect(loginPostCount).toBe(1)

    await page.getByTestId('account-menu').click()
    await page.getByTestId('sign-out').click()
    await expect(page).toHaveURL(/\/login/)

    await page.goto('/classrooms')
    await expect(page).toHaveURL(/\/login/)
  })

  test('a wrong password shows the translated message, not a code', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop',
      'login throttle budget: this login attempt only runs once, on desktop - see the budget comment at the top of this file',
    )

    await page.goto('/login')
    await fillLoginForm(page, ADMIN.login, 'definitely-wrong')
    await page.getByTestId('login-submit').click()

    const error = page.getByTestId('login-error')
    await expect(error).toBeVisible()
    await expect(error).toHaveText('Usuário ou senha incorretos.')
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
    // copy, never the e2e/.auth/admin.json file other tests still rely on.
    await page.goto('/classrooms')
    await expect(page.getByTestId('classrooms-list')).toBeVisible()

    await page.evaluate(() => window.localStorage.setItem('quimica.auth.token', 'no-longer-valid'))
    await page.reload()

    await expect(page).toHaveURL(/\/login/)
    // restore() got the 401, so the guard (the only navigation on first load)
    // carries both the expiry notice and the way back.
    const url = new URL(page.url())
    expect(url.searchParams.get('reason')).toBe('expired')
    expect(url.searchParams.get('redirect')).toBe('/classrooms')
    await expect(page.getByTestId('login-expired')).toHaveText('Sua sessão expirou. Entre novamente.')
  })
})
