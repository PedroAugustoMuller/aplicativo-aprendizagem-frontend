import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { request } from '@playwright/test'

// Where the shared session is written. Every test in the suite defaults to
// this storageState (see playwright.config.ts); the two tests that must run
// without a session override it explicitly.
const AUTH_FILE = fileURLToPath(new URL('./.auth/teacher.json', import.meta.url))
const API_URL = 'http://localhost:8080/api/v1'
const LOGIN_URL = `${API_URL}/auth/login`
const BRUNO_FILE = fileURLToPath(new URL('./.auth/bruno.json', import.meta.url))
const CARLA_FILE = fileURLToPath(new URL('./.auth/carla.json', import.meta.url))
const DIEGO_FILE = fileURLToPath(new URL('./.auth/diego.json', import.meta.url))
// DevelopmentAccountsSeeder's fixed id for diego.souza.
const DIEGO_ID = '0192f0a0-0000-7000-8000-000000000013'
const APP_ORIGIN = 'http://localhost:5173'
const TEACHER = { login: 'ana@escola.br', password: 'password' }
const TOKEN_STORAGE_KEY = 'dp2.auth.token'

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

/** Narrows the reset-password response to the temporary password it issued. */
function readTemporaryPassword(body: unknown): string {
  if (typeof body !== 'object' || body === null || !('data' in body)) {
    throw new Error('Unexpected reset-password response shape: missing "data".')
  }

  const { data } = body

  if (typeof data !== 'object' || data === null || !('temporary_password' in data)) {
    throw new Error('Unexpected reset-password response shape: missing "data.temporary_password".')
  }

  const { temporary_password: password } = data

  if (typeof password !== 'string') {
    throw new Error('Unexpected reset-password response shape: "temporary_password" is not a string.')
  }

  return password
}

/**
 * Logs in exactly once for the whole run and writes a storageState file that
 * every project (desktop, mobile) reuses as its default session. This exists
 * because the backend throttles login to 5 attempts/minute per email+IP: the
 * brief signs in through the form in nearly every test, which would blow that
 * budget in seconds once desktop and mobile run in parallel. See the comment
 * at the top of e2e/auth.spec.ts for the resulting login budget.
 */
async function signIn(
  context: Awaited<ReturnType<typeof request.newContext>>,
  credentials: { login: string; password: string },
  file: string,
): Promise<string> {
  const response = await context.post(LOGIN_URL, { data: credentials, headers: { Accept: 'application/json' } })

  if (response.status() === 429) {
    throw new Error(
      `Global setup hit the backend login throttle (429) for ${credentials.login}. Wait at least 60 seconds, then re-run the suite.`,
    )
  }

  if (!response.ok()) {
    throw new Error(`Global setup login for ${credentials.login} failed with HTTP ${response.status()}.`)
  }

  const token = readToken(await response.json())

  await mkdir(dirname(file), { recursive: true })
  await writeFile(
    file,
    JSON.stringify({
      cookies: [],
      origins: [{ origin: APP_ORIGIN, localStorage: [{ name: TOKEN_STORAGE_KEY, value: token }] }],
    }),
  )

  return token
}

export default async function globalSetup(): Promise<void> {
  const context = await request.newContext()

  try {
    const token = await signIn(context, TEACHER, AUTH_FILE)

    // Diego must start every run with a temporary password, even after a previous
    // run changed it. Reset through the admin API - no login spent, no reseed needed.
    const reset = await context.post(`${API_URL}/students/${DIEGO_ID}/reset-password`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })

    if (!reset.ok()) {
      throw new Error(`Global setup could not reset diego.souza's password (HTTP ${reset.status()}).`)
    }

    await writeFile(
      DIEGO_FILE,
      JSON.stringify({ login: 'diego.souza', password: readTemporaryPassword(await reset.json()) }),
    )

    // One login each, in their own throttle buckets (login+IP): Ana's budget is unchanged.
    await signIn(context, { login: 'bruno@escola.br', password: 'password' }, BRUNO_FILE)
    await signIn(context, { login: 'carla.dias', password: 'password' }, CARLA_FILE)
  } finally {
    await context.dispose()
  }
}
