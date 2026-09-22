// Test-only client for the admin API, used to set up fixtures without spending
// the shared admin's login-throttle budget. Every created user is signed in
// through its OWN bucket (loginApi), never the shared admin's - see the budget
// comment at the top of ../auth.spec.ts.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { type Page, request } from '@playwright/test'

export const API = 'http://localhost:8080/api/v1'
export const CHEMISTRY_ID = '0192f0a0-0000-7000-8000-000000000001'
export const ADMIN = { login: 'ana@escola.br', password: 'password' }

// Written by global-setup.ts once per run; read here, never re-created.
const ADMIN_TOKEN_FILE = fileURLToPath(new URL('../.auth/admin.json', import.meta.url))
const TOKEN_STORAGE_KEY = 'quimica.auth.token'

/** Unique per run and per project, so repeated and parallel runs never collide. */
export const runTag = (projectName: string): string => `${projectName}-${Date.now().toString(36)}`

// ---- response narrowing: no type assertions, every mismatch throws loudly ----

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function stringField(record: Record<string, unknown>, field: string, context: string): string {
  const value = record[field]
  if (typeof value !== 'string') {
    throw new Error(`Unexpected response shape from the backend (${context}): "${field}" is not a string.`)
  }
  return value
}

function arrayField(record: Record<string, unknown>, field: string, context: string): unknown[] {
  const value = record[field]
  if (!Array.isArray(value)) {
    throw new Error(`Unexpected response shape from the backend (${context}): "${field}" is not an array.`)
  }
  return value
}

/** Every endpoint below wraps its payload in `{ data: ... }`. */
function dataOf(body: unknown, context: string): unknown {
  if (!isRecord(body) || !('data' in body)) {
    throw new Error(`Unexpected response shape from the backend (${context}): missing "data".`)
  }
  return body.data
}

function dataRecord(body: unknown, context: string): Record<string, unknown> {
  const data = dataOf(body, context)
  if (!isRecord(data)) {
    throw new Error(`Unexpected response shape from the backend (${context}): "data" is not an object.`)
  }
  return data
}

// ---- transport: a throwaway request context per call, closed when done ----

async function send(
  method: 'get' | 'post' | 'put',
  path: string,
  token: string | undefined,
  data?: unknown,
): Promise<{ status: number; body: unknown }> {
  const context = await request.newContext()

  try {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token !== undefined) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await context[method](`${API}${path}`, { data, headers })
    const text = await response.text()

    return { status: response.status(), body: text === '' ? null : (JSON.parse(text) as unknown) }
  } finally {
    await context.dispose()
  }
}

function assertOk(status: number, context: string): void {
  if (status === 429) {
    throw new Error(`${context}: throttled (429). Wait at least 60s for the per-minute window to clear.`)
  }
  if (status < 200 || status >= 300) {
    throw new Error(`${context} failed with HTTP ${status}.`)
  }
}

// ---- fixtures ----

/** Reads the admin token global-setup wrote; never logs in again. */
export async function adminToken(): Promise<string> {
  const text = await readFile(ADMIN_TOKEN_FILE, 'utf-8')
  const body = JSON.parse(text) as unknown

  if (!isRecord(body)) {
    throw new Error('e2e/.auth/admin.json: root is not an object.')
  }

  const origins = arrayField(body, 'origins', 'e2e/.auth/admin.json')
  const origin = origins[0]
  if (!isRecord(origin)) {
    throw new Error('e2e/.auth/admin.json: origins[0] is not an object.')
  }

  const localStorageEntries = arrayField(origin, 'localStorage', 'e2e/.auth/admin.json origins[0]')
  const entry = localStorageEntries.find(
    (item): item is Record<string, unknown> => isRecord(item) && item.name === TOKEN_STORAGE_KEY,
  )
  if (entry === undefined) {
    throw new Error(`e2e/.auth/admin.json: no localStorage entry named "${TOKEN_STORAGE_KEY}".`)
  }

  return stringField(entry, 'value', 'e2e/.auth/admin.json localStorage entry')
}

export async function createTeacher(
  token: string,
  name: string,
  email: string,
): Promise<{ id: string; temporaryPassword: string }> {
  const { status, body } = await send('post', '/teachers', token, {
    id: globalThis.crypto.randomUUID(),
    name,
    email,
  })
  assertOk(status, 'POST /teachers')

  const data = dataRecord(body, 'POST /teachers')
  return {
    id: stringField(data, 'id', 'POST /teachers data'),
    temporaryPassword: stringField(data, 'temporary_password', 'POST /teachers data'),
  }
}

export async function createClassroom(token: string, name: string, subjectId: string): Promise<{ id: string }> {
  const { status, body } = await send('post', '/classrooms', token, {
    id: globalThis.crypto.randomUUID(),
    name,
    subject_id: subjectId,
  })
  assertOk(status, 'POST /classrooms')

  return { id: stringField(dataRecord(body, 'POST /classrooms'), 'id', 'POST /classrooms data') }
}

export async function assignTeachers(token: string, classroomId: string, teacherIds: string[]): Promise<void> {
  const { status } = await send('put', `/classrooms/${classroomId}/teachers`, token, { teacher_ids: teacherIds })
  assertOk(status, `PUT /classrooms/${classroomId}/teachers`)
}

export async function createStudents(
  token: string,
  classroomId: string,
  names: string[],
): Promise<{ id: string; login: string; temporaryPassword: string }[]> {
  const students = names.map((name) => ({ id: globalThis.crypto.randomUUID(), name }))
  const context = `POST /classrooms/${classroomId}/students`
  const { status, body } = await send('post', `/classrooms/${classroomId}/students`, token, { students })
  assertOk(status, context)

  const data = dataOf(body, context)
  if (!Array.isArray(data)) {
    throw new Error(`Unexpected response shape from the backend (${context}): "data" is not an array.`)
  }

  return data.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`Unexpected response shape from the backend (${context}): data[${index}] is not an object.`)
    }
    return {
      id: stringField(item, 'id', `${context} data[${index}]`),
      login: stringField(item, 'login', `${context} data[${index}]`),
      temporaryPassword: stringField(item, 'temporary_password', `${context} data[${index}]`),
    }
  })
}

/** One login attempt for THAT login's own throttle bucket. */
export async function loginApi(login: string, password: string): Promise<string> {
  const context = 'POST /auth/login'
  const { status, body } = await send('post', '/auth/login', undefined, { login, password })
  assertOk(status, context)

  return stringField(dataRecord(body, context), 'token', `${context} data`)
}

export async function changePasswordApi(token: string, current: string, next: string): Promise<void> {
  const { status } = await send('put', '/auth/password', token, {
    current_password: current,
    new_password: next,
  })
  assertOk(status, 'PUT /auth/password')
}

/** Writes a token into the page's localStorage before the app boots. */
export async function useToken(page: Page, token: string): Promise<void> {
  await page.addInitScript((value) => localStorage.setItem('quimica.auth.token', value), token)
}
