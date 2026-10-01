// Bruno's session, written once by e2e/global-setup.ts. No logins here.
import { expect, test } from '@playwright/test'

// DevelopmentAccountsSeeder: Química 1, taught by Bruno.
const CLASSROOM_ID = '0192f0a0-0000-7000-8000-000000000021'

test.use({ storageState: 'e2e/.auth/bruno.json' })

test('a teacher sees their classes but not the teacher admin', async ({ page }) => {
  await page.goto('/classrooms')

  await expect(page.getByTestId(`classroom-${CLASSROOM_ID}`)).toContainText('Química 1')
  await expect(page.getByTestId('classrooms-create')).toHaveCount(0)
  await expect(page.locator('a[href="/teachers"]')).toHaveCount(0)

  await page.goto('/teachers')
  await expect(page).toHaveURL(/\/subjects$/)
})

test('a teacher adds students, prints their access and enrols one back by search', async ({ page }, testInfo) => {
  const id = `${testInfo.project.name}-${Date.now()}`
  const removed = `Aluna A ${id}`
  const names = [removed, `Aluno B ${id}`, `Aluna C ${id}`]

  await page.goto(`/classrooms/${CLASSROOM_ID}`)
  await page.getByTestId('roster-add').click()
  // auto-grow adds a hidden sizer textarea next to the real one.
  await page.getByTestId('roster-names').locator('textarea:not(.v-textarea__sizer)').fill(names.join('\n'))
  await expect(page.getByTestId('roster-preview')).toHaveText('3 alunos serão criados')
  await page.getByTestId('roster-submit').click()

  await expect(page).toHaveURL(/\/credentials$/)
  for (const name of names) {
    await expect(page.getByTestId('credentials-grid')).toContainText(name)
  }

  await page.getByTestId('credentials-back').click()
  const row = page.locator('[data-testid^="roster-student-"]', { hasText: removed })
  await row.locator('[data-testid^="roster-remove-"]').click()
  await page.getByTestId('roster-remove-dialog-confirm').click()
  await expect(page.getByTestId('roster-list')).not.toContainText(removed)

  await page.getByTestId('roster-add-existing').click()
  await page.getByTestId('student-search-input').locator('input').fill(removed)
  const match = page.locator('[data-testid^="student-match-"]', { hasText: removed })
  await match.locator('input[type="checkbox"]').check()
  await page.getByTestId('student-search-submit').click()

  await expect(page.getByTestId('roster-list')).toContainText(removed)
})

test('offline, classes and the roster stay readable and changes are disabled', async ({ page, context }) => {
  // Online first: these visits leave the per-user copies behind.
  await page.goto(`/classrooms/${CLASSROOM_ID}`)
  await expect(page.getByTestId('roster-list')).toBeVisible()
  // The title renders from the class list, which shows only after its copy is saved.
  await expect(page.getByTestId('classroom-title')).toHaveText('Química 1')
  // Offline, the lazy page chunks come from the service worker's precache, as on
  // an installed phone: wait until it is installed before cutting the network.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.goto('/subjects')
  await expect(page.getByTestId('subjects-list')).toBeVisible()

  await context.setOffline(true)
  // Client-side navigation: a reload offline would need the service worker.
  await page.locator('a[href="/classrooms"]').first().click()
  await expect(page.getByTestId('offline-banner')).toBeVisible()
  await page.getByTestId(`classroom-${CLASSROOM_ID}`).click()
  await expect(page.getByTestId('offline-banner')).toBeVisible()
  await expect(page.getByTestId('roster-add')).toBeDisabled()
  await context.setOffline(false)
})

test('access slips print black on white even in dark mode', async ({ page }) => {
  // Browsers drop backgrounds when printing but keep text colour: light text
  // from the dark theme would vanish on paper.
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto(`/classrooms/${CLASSROOM_ID}/credentials`)
  await expect(page.getByTestId('credentials-grid')).toBeVisible()

  await page.emulateMedia({ colorScheme: 'dark', media: 'print' })
  const card = page.locator('[data-testid^="credential-"]').first()

  await expect(card).toHaveCSS('color', 'rgb(0, 0, 0)')
  await expect(card).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(card).toHaveCSS('border-top-color', 'rgb(0, 0, 0)')
})
