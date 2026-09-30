// Pages that must never be a destination: sending someone back to the page they
// just finished reuses the same component, so it looks like nothing happened.
const EXCLUDED = ['/login', '/change-password']

// Control characters and backslashes: the browser's URL parser strips or folds
// them, so "/\t/evil.com" would read as "//evil.com".
// eslint-disable-next-line no-control-regex
const UNSAFE = /[\u0000-\u001F\u007F\\]/

/**
 * The only way a `?redirect=` value may reach router.push: a plain in-app path,
 * never another origin, never a page that would loop. Anything else is null.
 */
export function safeRedirect(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || UNSAFE.test(value)) {
    return null
  }

  // vue-router matches paths case-insensitively, so the exclusion must too.
  const path = (value.split(/[?#]/, 1)[0] ?? '').toLowerCase()

  if (EXCLUDED.some((page) => path === page || path.startsWith(`${page}/`))) {
    return null
  }

  return value
}
