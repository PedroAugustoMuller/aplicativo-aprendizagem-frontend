// Ana's shared session (default storageState). No logins here - see e2e/auth.spec.ts.
import { expect, test } from '@playwright/test'

// Unique per run and per project, so re-runs never hit "name already taken".
const stamp = (project: string) => `${project}-${Date.now()}`

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
  await page.getByTestId('classroom-form-subject').click()
  await page.getByRole('option', { name: 'Química' }).click()
  await page.getByTestId('classroom-form-save').click()

  await expect(page.getByTestId('classrooms-list')).toContainText(name)
})
