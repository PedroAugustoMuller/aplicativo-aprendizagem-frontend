// No session needed: this only inspects the static <head> and the manifest
// file, neither of which depends on being signed in.
import { expect, test } from '@playwright/test'

interface ParsedManifest {
  name: string
  display: string
  iconCount: number
}

/** Narrows the manifest JSON without a type assertion. */
function readManifest(body: unknown): ParsedManifest {
  if (typeof body !== 'object' || body === null) {
    throw new Error('Manifest response is not a JSON object.')
  }

  if (!('name' in body) || typeof body.name !== 'string') {
    throw new Error('Manifest is missing a string "name".')
  }

  if (!('display' in body) || typeof body.display !== 'string') {
    throw new Error('Manifest is missing a string "display".')
  }

  if (!('icons' in body) || !Array.isArray(body.icons)) {
    throw new Error('Manifest is missing an "icons" array.')
  }

  return { name: body.name, display: body.display, iconCount: body.icons.length }
}

test.use({ storageState: { cookies: [], origins: [] } })

test('the app ships an installable manifest', async ({ page, request }) => {
  await page.goto('/login')

  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  if (href === null) {
    throw new Error('The document is missing <link rel="manifest">.')
  }

  const manifest = readManifest(await (await request.get(href)).json())
  expect(manifest.name).toBe('Quiz Escolar')
  expect(manifest.display).toBe('standalone')
  expect(manifest.iconCount).toBeGreaterThanOrEqual(2)
})
