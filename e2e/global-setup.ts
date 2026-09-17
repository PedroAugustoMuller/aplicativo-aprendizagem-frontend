import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { request } from '@playwright/test'

// Where the shared session is written. Every test in the suite defaults to
// this storageState (see playwright.config.ts); the two tests that must run
// without a session override it explicitly.
const AUTH_FILE = fileURLToPath(new URL('./.auth/teacher.json', import.meta.url))
const LOGIN_URL = 'http://localhost:8080/api/v1/auth/login'
const APP_ORIGIN = 'http://localhost:5173'
const TEACHER = { email: 'ana@escola.br', password: 'password' }
const TOKEN_STORAGE_KEY = 'quimica.auth.token'

/**
 * Narrows the login response body without a type assertion. The backend
 * contract is `{ data: { token, ... } }`; anything else is a signal that the
 * API changed shape, which should fail loudly rather than produce `undefined`.
 */
function readToken(body: unknown): string {
  if (typeof body !== 'object' || body === null || !('data' in body)) {
    throw new Error('Unexpected login response shape from the backend: missing "data".')
  }

  const { data } = body

  if (typeof data !== 'object' || data === null || !('token' in data)) {
    throw new Error('Unexpected login response shape from the backend: missing "data.token".')
  }

  const { token } = data

  if (typeof token !== 'string') {
    throw new Error('Unexpected login response shape from the backend: "data.token" is not a string.')
  }

  return token
}

/**
 * Logs in exactly once for the whole run and writes a storageState file that
 * every project (desktop, mobile) reuses as its default session. This exists
 * because the backend throttles login to 5 attempts/minute per email+IP: the
 * brief signs in through the form in nearly every test, which would blow that
 * budget in seconds once desktop and mobile run in parallel. See the comment
 * at the top of e2e/auth.spec.ts for the resulting login budget.
 */
export default async function globalSetup(): Promise<void> {
  const context = await request.newContext()

  try {
    const response = await context.post(LOGIN_URL, {
      data: TEACHER,
      headers: { Accept: 'application/json' },
    })

    if (response.status() === 429) {
      throw new Error(
        'Global setup hit the backend login throttle (429) while signing in for the shared ' +
          'session. Wait at least 60 seconds for the per-minute window to clear, then re-run ' +
          'the suite.',
      )
    }

    if (!response.ok()) {
      throw new Error(`Global setup login failed with HTTP ${response.status()}.`)
    }

    const token = readToken(await response.json())

    await mkdir(dirname(AUTH_FILE), { recursive: true })
    await writeFile(
      AUTH_FILE,
      JSON.stringify({
        cookies: [],
        origins: [
          {
            origin: APP_ORIGIN,
            localStorage: [{ name: TOKEN_STORAGE_KEY, value: token }],
          },
        ],
      }),
    )
  } finally {
    await context.dispose()
  }
}
