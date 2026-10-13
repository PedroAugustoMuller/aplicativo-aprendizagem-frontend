// Ana's shared session (default storageState). No logins here - see e2e/auth.spec.ts.
import { expect, test, type Page } from '@playwright/test'

// Unique per run and per project, so re-runs never hit "name already taken".
const stamp = (project: string) => `${project}-${Date.now()}`

/**
 * The classes list grows every run, so a card's buttons often sit under the sticky app bar
 * (desktop) or the bottom navigation (phone), and Playwright's own scroll puts them right
 * there. Wait for the list to settle, then click the button itself rather than a screen point.
 */
async function clickInList(page: Page, testid: string): Promise<void> {
  await expect(page.getByTestId('classrooms-loading')).toHaveCount(0)
  const button = page.getByTestId(testid)
  await expect(button).toBeEnabled()
  await button.dispatchEvent('click')
}

test('an admin creates a teacher and sees the temporary password once', async ({ page }, testInfo) => {
  const id = stamp(testInfo.project.name)

  await page.goto('/teachers')
  await page.getByTestId('teachers-create').click()
  // Vuetify applies autofocus after mount; filling before it lands sends the
  // next field's text into the autofocused one.
  await expect(page.getByTestId('teacher-form-name').locator('input')).toBeFocused()
  await page.getByTestId('teacher-form-name').locator('input').fill(`Professora ${id}`)
  await page.getByTestId('teacher-form-email').locator('input').fill(`prof-${id}@escola.br`)
  await page.getByTestId('teacher-form-save').click()

  await expect(page.getByTestId('password-dialog-password')).toHaveText(/^\S{8}$/)
  await page.getByTestId('password-dialog-close').click()
  await expect(page.getByTestId('teachers-list')).toContainText(`prof-${id}@escola.br`)
})

test('an admin creates a class for a subject', async ({ page }, testInfo) => {
  const name = `Turma ${stamp(testInfo.project.name)}`

  await page.goto('/classrooms')
  await page.getByTestId('classrooms-create').click()
  await expect(page.getByTestId('classroom-form-name').locator('input')).toBeFocused()
  await page.getByTestId('classroom-form-name').locator('input').fill(name)
  await page.getByTestId('classroom-form-subjects').click()
  await page.getByRole('option', { name: 'Química' }).click()
  await page.keyboard.press('Escape')
  await page.getByTestId('classroom-form-save').click()

  await expect(page.getByTestId('classrooms-list')).toContainText(name)
})

test('an admin gives a class two subjects and a teacher only one of them', async ({ page, browser }, testInfo) => {
  const name = `Turma ${stamp(testInfo.project.name)}`

  await page.goto('/classrooms')
  await page.getByTestId('classrooms-create').click()
  await expect(page.getByTestId('classroom-form-name').locator('input')).toBeFocused()
  await page.getByTestId('classroom-form-name').locator('input').fill(name)
  await page.getByTestId('classroom-form-subjects').click()
  await page.getByRole('option', { name: 'Química' }).click()
  await page.getByRole('option', { name: 'Biologia' }).click()
  await page.keyboard.press('Escape')
  await page.getByTestId('classroom-form-save').click()

  const card = page.locator('a[data-testid^="classroom-"]', { hasText: name })
  await expect(card).toContainText('Química · Biologia')
  const classroomId = ((await card.getAttribute('data-testid')) ?? '').replace('classroom-', '')

  await clickInList(page, `classroom-teachers-${classroomId}`)
  await page.getByTestId('assign-add').click()
  await page.getByTestId('assign-row-0-teacher').click()
  await page.getByRole('option', { name: 'Professor Bruno' }).click()
  await page.getByTestId('assign-row-0-scope').click()
  await page.getByRole('option', { name: 'Biologia' }).click()
  await page.getByTestId('assign-teachers-save').click()
  await expect(page.getByTestId(`classroom-${classroomId}`)).toContainText('Professor Bruno (Biologia)')

  // Bruno's stored session: the class shows up with only its Biologia grid. No login spent.
  const bruno = await browser.newContext({ storageState: 'e2e/.auth/bruno.json' })
  const brunoPage = await bruno.newPage()
  await brunoPage.goto(`/classrooms/${classroomId}`)
  await expect(brunoPage.getByTestId('classroom-progress')).toHaveAttribute('href', new RegExp(`/classrooms/${classroomId}/subjects/[^/]+/progress$`))
  await bruno.close()

  // Leave Bruno's subjects as they were for the other suites.
  await clickInList(page, `classroom-deactivate-${classroomId}`)
  await page.getByTestId('classroom-deactivate-dialog-confirm').click()
  await expect(page.getByTestId(`classroom-${classroomId}`)).toContainText('Inativa')
})
