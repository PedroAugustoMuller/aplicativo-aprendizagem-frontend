// Sessions written once by e2e/global-setup.ts. No logins here - see the login
// budget comment at the top of e2e/auth.spec.ts.
import { expect, test, type Page } from '@playwright/test'

// SubjectsSeeder's fixed id for Química.
const CHEMISTRY_ID = '0192f0a0-0000-7000-8000-000000000001'
const TOPICS = `/subjects/${CHEMISTRY_ID}/topics`

// desktop and mobile run in parallel as the same student, and a student has one
// open quiz per topic: give each project its own topic so they never share one.
const TOPIC_BY_PROJECT: Record<string, string> = { desktop: 'Tabela Periódica', mobile: 'Ligações Químicas' }

async function topicIdNamed(page: Page, name: string): Promise<string> {
  const card = page.locator('[data-testid^="topic-"]', { has: page.locator('.v-card-title', { hasText: name }) })
  const testid = await card.first().getAttribute('data-testid')

  return (testid ?? '').replace('topic-', '')
}

/** Starts the topic's quiz, or continues the one an earlier run left open on the server. */
async function openQuiz(page: Page, topicId: string): Promise<void> {
  const resume = page.getByTestId(`quiz-continue-${topicId}`)
  await (await resume.isVisible() ? resume : page.getByTestId(`quiz-start-${topicId}`)).click()
  await expect(page).toHaveURL(/\/quiz\//)
}

/** Answers every remaining question with its first option until the results show. */
async function answerAll(page: Page, feedback: RegExp): Promise<void> {
  while (!(await page.getByTestId('quiz-results').isVisible())) {
    await page.getByTestId('quiz-option-0').click()
    await page.getByTestId('quiz-submit').click()
    await expect(page.getByTestId(feedback)).toBeVisible()
    await page.getByTestId('quiz-next').click()
  }
}

test.describe('a student plays quizzes', () => {
  // Its own token, so its requests do not share a rate-limit bucket with the
  // other Carla specs (see e2e/global-setup.ts).
  test.use({ storageState: 'e2e/.auth/carla-quiz.json' })
  test.describe.configure({ mode: 'serial' })

  test('answers a whole quiz online and sees the score', async ({ page }, testInfo) => {
    const name = TOPIC_BY_PROJECT[testInfo.project.name] ?? 'Tabela Periódica'
    await page.goto(TOPICS)
    await expect(page.getByTestId('topics-list')).toBeVisible()
    const topicId = await topicIdNamed(page, name)

    await openQuiz(page, topicId)
    await expect(page.getByTestId('quiz-title')).toHaveText(name)
    await answerAll(page, /^quiz-feedback-(correct|wrong)$/)

    await expect(page.getByTestId('quiz-score')).toHaveText(/^Você acertou \d+ de \d+$/)
    await expect(page.getByTestId('quiz-results-pending')).toHaveCount(0)
    await expect(page.getByTestId('quiz-results-tier')).toHaveText(/^Você está no nível \S+ \(\d+ pts\)$/)
  })

  test('picks up an unfinished quiz where it stopped', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'needs a topic with more than one question')
    await page.goto(TOPICS)
    const topicId = await topicIdNamed(page, 'Tabela Periódica')
    await openQuiz(page, topicId)
    await page.getByTestId('quiz-option-0').click()
    await page.getByTestId('quiz-submit').click()
    await expect(page.getByTestId(/^quiz-feedback-(correct|wrong)$/)).toBeVisible()

    await page.getByTestId('quiz-back').click()
    await expect(page.getByTestId(`quiz-continue-${topicId}`)).toContainText('Continuar quiz (1 de')
    await page.getByTestId(`quiz-continue-${topicId}`).click()
    await expect(page.getByTestId('quiz-progress-label')).toHaveText(/^Questão 2 de \d+$/)

    // Leave the server with no open attempt for the next run.
    await answerAll(page, /^quiz-feedback-(correct|wrong)$/)
  })

  test('downloads a quiz, answers it offline and gets the results back online', async ({ page, context }, testInfo) => {
    const name = TOPIC_BY_PROJECT[testInfo.project.name] ?? 'Tabela Periódica'
    await page.goto(TOPICS)
    await expect(page.getByTestId('topics-list')).toBeVisible()
    const topicId = await topicIdNamed(page, name)

    await page.getByTestId(`quiz-download-${topicId}`).click()
    await expect(page.getByTestId(`quiz-downloaded-${topicId}`)).toBeVisible()
    // Offline, the lazy page chunks come from the service worker's precache.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })

    await context.setOffline(true)
    await page.getByTestId(`quiz-continue-${topicId}`).click()
    await answerAll(page, /^quiz-feedback-pending$/)
    await expect(page.getByTestId('quiz-results-pending')).toBeVisible()
    await expect(page.getByTestId('quiz-pending-chip')).toBeVisible()

    await context.setOffline(false)
    await expect(page.getByTestId('quiz-results-pending')).toHaveCount(0)
    await expect(page.getByTestId('quiz-pending-chip')).toHaveCount(0)
    await expect(page.getByTestId('quiz-score')).toHaveText(/^Você acertou \d+ de \d+$/)
  })

  test('opens a downloaded quiz from a cold start with no internet', async ({ page, context }, testInfo) => {
    const name = TOPIC_BY_PROJECT[testInfo.project.name] ?? 'Tabela Periódica'
    await page.goto(TOPICS)
    await expect(page.getByTestId('topics-list')).toBeVisible()
    const topicId = await topicIdNamed(page, name)

    await page.getByTestId(`quiz-download-${topicId}`).click()
    await expect(page.getByTestId(`quiz-downloaded-${topicId}`)).toBeVisible()
    await page.getByTestId(`quiz-continue-${topicId}`).click()
    await expect(page).toHaveURL(/\/quiz\//)
    const quizUrl = page.url()
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })

    // "Closing the app": the page goes away; only the service worker, its
    // precache and IndexedDB remain. Then a fresh page, already offline.
    await page.close()
    await context.setOffline(true)
    const reopened = await context.newPage()
    await reopened.goto(quizUrl)

    await reopened.getByTestId('quiz-option-0').click()
    await reopened.getByTestId('quiz-submit').click()
    await expect(reopened.getByTestId('quiz-feedback-pending')).toBeVisible()
    await reopened.getByTestId('quiz-next').click()
    await answerAll(reopened, /^quiz-feedback-pending$/)
    await expect(reopened.getByTestId('quiz-results-pending')).toBeVisible()

    await context.setOffline(false)
    await expect(reopened.getByTestId('quiz-score')).toHaveText(/^Você acertou \d+ de \d+$/)
  })
})

test.describe('a teacher', () => {
  test.use({ storageState: 'e2e/.auth/bruno.json' })

  test('cannot open the quiz page', async ({ page }) => {
    await page.goto('/quiz/0192f0a0-0000-7000-8000-00000000dead')
    await expect(page).toHaveURL(/\/subjects$/)
  })
})
