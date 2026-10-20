// Sessions written once by e2e/global-setup.ts. No logins here - see the login
// budget comment at the top of e2e/auth.spec.ts. Needs the backend on AI_PROVIDER=fake
// (backend .env.example), whose per-user generation limit this journey spends 2 of per run.
import { expect, test, type Page } from '@playwright/test'

const CHEMISTRY_ID = '0192f0a0-0000-7000-8000-000000000001'
const TOPICS = `/subjects/${CHEMISTRY_ID}/topics`

// Hand-written one-page PDF; pdf.js rebuilds the missing xref table.
const PDF = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 400 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 60 >> stream
BT /F1 18 Tf 20 80 Td (A agua ferve a 100 graus Celsius) Tj ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
trailer << /Root 1 0 R /Size 6 >>
%%EOF
`

async function topicIdNamed(page: Page, name: string): Promise<string> {
  const card = page.locator('[data-testid^="topic-"]', { has: page.locator('.v-card-title', { hasText: name }) })

  return ((await card.first().getAttribute('data-testid')) ?? '').replace('topic-', '')
}

test.describe('a teacher uses ai suggestions', () => {
  test.use({ storageState: 'e2e/.auth/bruno-suggestions.json' })

  test('generates, accepts one, edits one, discards one, and reads a pdf', async ({ page }, testInfo) => {
    const topicName = `Sugestões e2e ${testInfo.project.name}-${Date.now()}`

    await page.goto(TOPICS)
    await page.getByTestId('topics-create').click()
    const name = page.getByTestId('topic-form-name').locator('input')
    await expect(name).toBeFocused()
    await name.fill(topicName)
    await page.getByTestId('topic-form-save').click()
    await expect(page.getByTestId('topic-form')).toHaveCount(0)
    const topicId = await topicIdNamed(page, topicName)
    await page.getByTestId(`topic-${topicId}`).click()

    await page.getByTestId('questions-suggest').click()
    await expect(page).toHaveURL(new RegExp(`/topics/${topicId}/questions/suggestions$`))

    // The PDF's text lands in the source field.
    await page.getByTestId('suggestions-file').setInputFiles({ name: 'aula.pdf', mimeType: 'application/pdf', buffer: Buffer.from(PDF) })
    await expect(page.getByTestId('suggestions-source').locator('textarea:not(.v-textarea__sizer)')).toHaveValue(/A agua ferve a 100 graus/)

    await page.getByTestId('suggestions-count').click()
    await page.getByRole('option', { name: '3', exact: true }).click()
    await page.getByTestId('suggestions-generate').click()
    const items = page.locator('[data-testid^="suggestion-item-"]')
    await expect(items).toHaveCount(3)

    // Accept the first.
    await items.nth(0).locator('[data-testid^="suggestion-accept-"]').click()
    await expect(items).toHaveCount(2)

    // Edit the next one and save it with a new statement.
    await items.nth(0).locator('[data-testid^="suggestion-edit-"]').click()
    const statement = page.getByTestId('question-form-statement').locator('textarea:not(.v-textarea__sizer)')
    await expect(statement).toBeFocused()
    await statement.fill(`Editada ${topicName}`)
    await page.getByTestId('question-form-save').click()
    await expect(page).toHaveURL(/\/questions\/suggestions$/)
    await expect(items).toHaveCount(1)

    // Discard the last.
    await items.nth(0).locator('[data-testid^="suggestion-discard-"]').click()
    await expect(page.getByTestId('suggestions-empty')).toBeVisible()

    // The bank holds exactly the two kept.
    await page.getByTestId('suggestions-back').click()
    await expect(page.locator('[data-testid^="question-item-"]')).toHaveCount(2)
    await expect(page.getByText(`Editada ${topicName}`)).toBeVisible()
  })
})
