// Sessions written once by e2e/global-setup.ts. No logins here - see the login
// budget comment at the top of e2e/auth.spec.ts.
import { expect, test, type Page } from '@playwright/test'

// SubjectsSeeder's fixed id for Química.
const CHEMISTRY_ID = '0192f0a0-0000-7000-8000-000000000001'
const TOPICS = `/subjects/${CHEMISTRY_ID}/topics`

async function topicIdNamed(page: Page, name: string): Promise<string> {
  const card = page.locator('[data-testid^="topic-"]', { has: page.locator('.v-card-title', { hasText: name }) })
  const testid = await card.first().getAttribute('data-testid')

  return (testid ?? '').replace('topic-', '')
}

const statementField = (page: Page) => page.getByTestId('question-form-statement').locator('textarea:not(.v-textarea__sizer)')

test.describe('a teacher authors content', () => {
  test.use({ storageState: 'e2e/.auth/bruno.json' })

  test('creates and reorders a topic, then writes, edits and deactivates questions', async ({ page }, testInfo) => {
    const id = `${testInfo.project.name}-${Date.now()}`
    const topicName = `Conteúdo e2e ${id}`

    await page.goto(TOPICS)
    await expect(page.getByTestId('topics-list')).toBeVisible()
    await page.getByTestId('topics-create').click()
    const name = page.getByTestId('topic-form-name').locator('input')
    await expect(name).toBeFocused()
    await name.fill(topicName)
    await page.getByTestId('topic-form-save').click()
    await expect(page.getByTestId('topic-form')).toHaveCount(0)

    const titles = page.locator('[data-testid^="topic-"] .v-card-title')
    await expect(titles.filter({ hasText: topicName })).toHaveCount(1)
    const topicId = await topicIdNamed(page, topicName)
    await expect(page.getByTestId(`topic-${topicId}`)).toBeVisible()

    // The parallel desktop/mobile projects share this list: assert order relative to the neighbour.
    const before = (await titles.allTextContents()).map((t) => t.trim())
    const neighbour = before[before.indexOf(topicName) - 1] ?? ''
    expect(neighbour).not.toBe('')

    await page.getByTestId(`topic-up-${topicId}`).click()
    await expect
      .poll(async () => {
        const after = (await titles.allTextContents()).map((t) => t.trim())

        return after.indexOf(topicName) < after.indexOf(neighbour)
      })
      .toBe(true)

    await page.getByTestId(`topic-${topicId}`).click()
    await expect(page).toHaveURL(new RegExp(`/topics/${topicId}/questions$`))
    await expect(page.getByTestId('questions-title')).toHaveText(topicName)
    await expect(page.getByTestId('questions-empty')).toBeVisible()

    // Multiple choice.
    await page.getByTestId('questions-create').click()
    // Vuetify applies autofocus after mount; filling before it lands sends later text into the statement.
    await expect(statementField(page)).toBeFocused()
    await statementField(page).fill(`Símbolo do sódio? ${id}`)
    await page.getByTestId('question-form-option-text-0').locator('input').fill('Na')
    await page.getByTestId('question-form-option-text-1').locator('input').fill('S')
    await page.getByTestId('question-form-correct-0').locator('input').check()
    await page.getByTestId('question-form-save').click()
    await expect(page).toHaveURL(new RegExp(`/topics/${topicId}/questions$`))
    const mc = page.locator('[data-testid^="question-item-"]', { hasText: `Símbolo do sódio? ${id}` })
    await expect(mc.getByTestId('question-correct')).toContainText('Na')

    // True/false: the student-facing option texts come from the server.
    await page.getByTestId('questions-create').click()
    await expect(statementField(page)).toBeFocused()
    await page.getByTestId('question-form-type-true_false').click()
    await statementField(page).fill(`O sódio é um metal. ${id}`)
    await page.getByTestId('question-form-answer-true').locator('input').check()
    await page.getByTestId('question-form-save').click()
    const tf = page.locator('[data-testid^="question-item-"]', { hasText: `O sódio é um metal. ${id}` })
    await expect(tf.getByTestId('question-correct')).toContainText('Verdadeiro')

    // Edit the multiple-choice question.
    await mc.locator('[data-testid^="question-edit-"]').click()
    await expect(statementField(page)).toHaveValue(`Símbolo do sódio? ${id}`)
    await statementField(page).fill(`Qual é o símbolo do sódio? ${id}`)
    await page.getByTestId('question-form-save').click()
    await expect(page.locator('[data-testid^="question-item-"]', { hasText: `Qual é o símbolo do sódio? ${id}` })).toBeVisible()

    // Deactivate the true/false question: hidden until asked for.
    await tf.locator('[data-testid^="question-toggle-"]').click()
    await page.getByTestId('question-deactivate-dialog-confirm').click()
    await expect(tf).toHaveCount(0)
    await page.getByTestId('questions-show-inactive').locator('input').check()
    await expect(tf.getByTestId('question-inactive')).toBeVisible()
  })

  test('offline, the question bank stays readable and writing is disabled', async ({ page, context }) => {
    await page.goto(TOPICS)
    await expect(page.getByTestId('topics-list')).toBeVisible()
    const topicId = await topicIdNamed(page, 'Tabela Periódica')
    await page.getByTestId(`topic-${topicId}`).click()
    await expect(page.getByTestId('questions-list')).toBeVisible()
    // Offline, the lazy page chunks come from the service worker's precache.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await page.getByTestId('questions-back').click()
    await expect(page.getByTestId('topics-list')).toBeVisible()

    await context.setOffline(true)
    // Client-side navigation: a reload offline would need the service worker.
    await page.getByTestId(`topic-${topicId}`).click()
    await expect(page.getByTestId('offline-banner')).toBeVisible()
    await expect(page.getByTestId('questions-list')).toBeVisible()
    await expect(page.getByTestId('questions-create')).toHaveClass(/v-btn--disabled/)
    await context.setOffline(false)
  })
})

test.describe('a student', () => {
  test.use({ storageState: 'e2e/.auth/carla.json' })

  test('sees no authoring controls and cannot open a question bank', async ({ page }) => {
    await page.goto(TOPICS)
    await expect(page.getByTestId('topics-list')).toBeVisible()
    await expect(page.locator('.v-card-title', { hasText: 'Tabela Periódica' })).toBeVisible()
    await expect(page.getByTestId('topics-create')).toHaveCount(0)
    await expect(page.locator('[data-testid^="topic-edit-"]')).toHaveCount(0)

    await page.goto(`${TOPICS}/0192f0a0-0000-7000-8000-0000000000ff/questions`)
    await expect(page).toHaveURL(/\/subjects$/)
  })
})
