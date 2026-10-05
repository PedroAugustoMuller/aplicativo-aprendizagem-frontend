// Sessions written once by e2e/global-setup.ts. No logins here - see the login
// budget comment at the top of e2e/auth.spec.ts.
import { expect, test, type Page } from '@playwright/test'

// SubjectsSeeder's fixed id for Química; DevelopmentAccountsSeeder's ids.
const CHEMISTRY_ID = '0192f0a0-0000-7000-8000-000000000001'
const CHEMISTRY_1_CLASSROOM_ID = '0192f0a0-0000-7000-8000-000000000021'
const CARLA_ID = '0192f0a0-0000-7000-8000-000000000012'
const TOPICS = `/subjects/${CHEMISTRY_ID}/topics`

async function topicIdNamed(page: Page, name: string): Promise<string> {
  const card = page.locator('[data-testid^="topic-"]', { has: page.locator('.v-card-title', { hasText: name }) })
  const testid = await card.first().getAttribute('data-testid')

  return (testid ?? '').replace('topic-', '')
}

/** A level-up not yet celebrated in this browser may open over the page. */
async function closeLevelUp(page: Page): Promise<void> {
  const close = page.getByTestId('level-up-close')

  if (await close.isVisible()) {
    await close.click()
  }
}

test.describe('a student follows their progress', () => {
  test.use({ storageState: 'e2e/.auth/carla.json' })

  test('sees their tier, their quizzes, a quiz review and the study list', async ({ page }) => {
    await page.goto(TOPICS)
    await expect(page.getByTestId('topics-list')).toBeVisible()
    const topicId = await topicIdNamed(page, 'Tabela Periódica')

    const badge = page.getByTestId(`topic-tier-${topicId}`)
    await expect(badge).toContainText(/\d+ pts$/)
    await badge.click()

    await expect(page).toHaveURL(new RegExp(`/topics/${topicId}/progress$`))
    await expect(page.getByTestId('progress-title')).toHaveText('Tabela Periódica')
    await expect(page.getByTestId('progress-to-next')).toBeVisible()
    await closeLevelUp(page)

    // The seed's quizzes are finished: open the oldest one's review.
    const finished = page.locator('[data-testid^="progress-attempt-"][href$="/review"]').last()
    await finished.click()
    await expect(page).toHaveURL(/\/quiz\/[^/]+\/review$/)
    await expect(page.getByTestId('quiz-result-0')).toBeVisible()
    await page.getByTestId('review-back').click()

    await page.getByTestId('progress-review-wrong').click()
    await expect(page).toHaveURL(new RegExp(`/topics/${topicId}/review$`))
    await expect(page.getByTestId('wrong-question-0')).toContainText('Resposta certa:')
  })
})

// The default session (the admin): Bruno's token already carries the teacher journeys,
// and the API limits each token to 120 requests a minute.
test.describe('staff follow a classroom', () => {
  test('opens the classroom grid and a student topic page', async ({ page }) => {
    await page.goto(`/classrooms/${CHEMISTRY_1_CLASSROOM_ID}`)
    await page.getByTestId('classroom-progress').click()
    await expect(page).toHaveURL(new RegExp(`/classrooms/${CHEMISTRY_1_CLASSROOM_ID}/progress$`))

    const cell = page.locator(`[data-testid^="classroom-progress-cell-${CARLA_ID}-"]`).first()
    // Every e2e run enrols more students in this classroom; on the phone layout the whole
    // grid renders in ~5 s under the parallel suite, past the default 5 s.
    await expect(cell).toContainText(/\d+ pts$/, { timeout: 15_000 })
    await cell.click()

    await expect(page.getByTestId('progress-student')).toHaveText('Desempenho de Carla Dias')
    await expect(page.getByTestId('progress-to-next')).toBeVisible()
  })

  test('sees which questions the classroom gets wrong, then all classrooms', async ({ page }) => {
    await page.goto(`/classrooms/${CHEMISTRY_1_CLASSROOM_ID}/progress`)
    const topic = page.locator('[data-testid^="classroom-progress-topic-"]', { hasText: 'Tabela Periódica' })
    await topic.click()
    await expect(page).toHaveURL(new RegExp(`/classrooms/${CHEMISTRY_1_CLASSROOM_ID}/topics/[^/]+/questions$`))

    // Counts depend on what earlier e2e runs left in the development database: check the shape.
    await expect(page.getByTestId('question-summary-context')).toHaveText(/^\d+ alunos · \d+ questões respondidas$/)
    await expect(page.locator('[data-testid^="question-summary-band-"]').first()).toContainText(/\d+% erraram/)
    await expect(page.getByText('resposta certa').first()).toBeVisible()

    await page.getByTestId('question-summary-scope-all').click()
    await expect(page).toHaveURL(/\?scope=all$/)
    await expect(page.getByTestId('question-summary-context')).toHaveText(/^\d+ alunos/)
  })
})
