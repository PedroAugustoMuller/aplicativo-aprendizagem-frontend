import { expect, test } from '@playwright/test'
import {
  adminToken,
  assignTeachers,
  changePasswordApi,
  CHEMISTRY_ID,
  createClassroom,
  createStudents,
  createTeacher,
  loginApi,
  runTag,
  useToken,
} from './support/api.ts'

const NEW_PASSWORD = 'senha-e2e-123'

test.describe('roster and credentials', () => {
  test.describe.configure({ retries: 0 })

  test('an admin creates a classroom and assigns a teacher', async ({ page, browser }, testInfo) => {
    // Uses the shared admin session (no session override, no login) - see the
    // budget comment at the top of e2e/auth.spec.ts.
    const admin = await adminToken()
    const tag = runTag(testInfo.project.name)
    const teacherName = `Professor Turmas ${tag}`
    const teacherEmail = `professor.turmas.${tag}@escola.br`
    const teacher = await createTeacher(admin, teacherName, teacherEmail)

    await page.goto('/classrooms')
    await page.getByTestId('classrooms-create').click()
    await page.getByTestId('classroom-name-input').locator('input').fill(`E2E Turma ${tag}`)
    await page.getByTestId('classroom-subject-select').click()
    await page.getByRole('option', { name: 'Química' }).click()
    await page.getByTestId('classroom-save').click()

    const row = page.locator('[data-testid^="classroom-row-"]', { hasText: `E2E Turma ${tag}` })
    await expect(row).toBeVisible()
    await row.locator('[data-testid^="classroom-teachers-"]').click()

    await page.getByTestId('assign-teachers-select').click()
    await page.getByTestId('assign-teachers-select').locator('input').fill(teacherName)
    await page.getByRole('option', { name: teacherName }).click()
    await page.getByTestId('assign-teachers-save').click()

    // Confirm from the teacher's own point of view, in a fresh context signed
    // in through that teacher's own throttle bucket - never the shared admin's.
    const teacherContext = await browser.newContext()
    try {
      const teacherPage = await teacherContext.newPage()
      const pendingToken = await loginApi(teacherEmail, teacher.temporaryPassword)
      await changePasswordApi(pendingToken, teacher.temporaryPassword, NEW_PASSWORD)
      await useToken(teacherPage, pendingToken)

      await teacherPage.goto('/classrooms')
      await expect(teacherPage.getByText(`E2E Turma ${tag}`)).toBeVisible()
    } finally {
      await teacherContext.close()
    }
  })

  test.describe('without a session', () => {
    test.use({ storageState: { cookies: [], origins: [] } })

    test('a teacher pastes names and prints slips', async ({ page }, testInfo) => {
      const admin = await adminToken()
      const tag = runTag(testInfo.project.name)
      const teacherEmail = `professor.pasta.${tag}@escola.br`
      const teacher = await createTeacher(admin, `Professor Pasta ${tag}`, teacherEmail)
      const classroom = await createClassroom(admin, `E2E Pasta ${tag}`, CHEMISTRY_ID)
      await assignTeachers(admin, classroom.id, [teacher.id])

      const teacherToken = await loginApi(teacherEmail, teacher.temporaryPassword)
      await changePasswordApi(teacherToken, teacher.temporaryPassword, NEW_PASSWORD)
      await useToken(page, teacherToken)

      await page.goto(`/classrooms/${classroom.id}`)
      await page.getByTestId('roster-paste').click()
      await page
        .getByTestId('paste-textarea')
        .locator('textarea')
        .fill(`Ana Souza ${tag}\nBia Lima ${tag}\nana souza ${tag}`)
      await expect(page.getByTestId('paste-duplicates')).toBeVisible()
      await page.getByTestId('paste-submit').click()

      const result = page.getByTestId('paste-result')
      await expect(result).toBeVisible()
      await expect(result.locator('.v-list-item')).toHaveCount(2)

      await page.getByTestId('paste-print-slips').click()
      await expect(page).toHaveURL(new RegExp(`/classrooms/${classroom.id}/credentials`))

      const slips = page.locator('[data-testid^="slip-"]')
      await expect(slips).toHaveCount(2)
      for (const slip of await slips.all()) {
        const password = await slip.locator('.slip__mono').nth(1).textContent()
        expect(password?.trim()).toMatch(/^[A-Za-z0-9]{8}$/)
      }
    })

    test('a new student is forced to change the password, then sees their classroom', async ({ page }, testInfo) => {
      const admin = await adminToken()
      const tag = runTag(testInfo.project.name)
      const classroom = await createClassroom(admin, `E2E Forcado ${tag}`, CHEMISTRY_ID)
      const [student] = await createStudents(admin, classroom.id, [`Aluno Forcado ${tag}`])
      if (student === undefined) throw new Error('Expected one created student.')

      await page.goto('/login')
      await page.getByTestId('login-identifier').locator('input').fill(student.login)
      await page.getByTestId('login-password').locator('input').fill(student.temporaryPassword)
      await page.getByTestId('login-submit').click()

      await expect(page).toHaveURL(/\/change-password/)
      await expect(page.getByTestId('password-forced-notice')).toBeVisible()

      await page.getByTestId('password-current').locator('input').fill(student.temporaryPassword)
      await page.getByTestId('password-new').locator('input').fill(NEW_PASSWORD)
      await page.getByTestId('password-confirm').locator('input').fill(NEW_PASSWORD)
      await page.getByTestId('password-submit').click()

      await expect(page).toHaveURL(/\/my-classrooms/)
      const card = page.getByTestId(`my-classroom-${classroom.id}`)
      await expect(card).toBeVisible()
      await card.getByRole('link', { name: 'Ver conteúdos' }).click()

      await expect(page.getByTestId('topics-list')).toBeVisible()
    })
  })
})
