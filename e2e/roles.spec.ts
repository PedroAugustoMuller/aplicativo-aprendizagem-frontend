import { expect, test } from '@playwright/test'
import { adminToken, changePasswordApi, CHEMISTRY_ID, createClassroom, createStudents, loginApi, runTag, useToken } from './support/api.ts'

test.describe('role routing', () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  test.describe.configure({ retries: 0 })

  test('a student opening a staff URL lands on their own classrooms', async ({ page }, testInfo) => {
    const admin = await adminToken()
    const tag = runTag(testInfo.project.name)
    const classroom = await createClassroom(admin, `E2E Roles ${tag}`, CHEMISTRY_ID)
    const [student] = await createStudents(admin, classroom.id, [`Aluno Rotas ${tag}`])
    if (student === undefined) throw new Error('Expected one created student.')

    const pendingToken = await loginApi(student.login, student.temporaryPassword)
    await changePasswordApi(pendingToken, student.temporaryPassword, 'senha-e2e-123')
    await useToken(page, pendingToken)

    await page.goto('/teachers')

    await expect(page).toHaveURL(/\/my-classrooms$/)
    await expect(page.getByTestId(`my-classroom-${classroom.id}`)).toBeVisible()
    await expect(page.getByTestId('nav-teachers')).toHaveCount(0)
  })
})
