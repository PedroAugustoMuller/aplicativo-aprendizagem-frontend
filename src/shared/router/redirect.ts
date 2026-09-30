// Pages that must never be a destination: sending someone back to the page they
// just finished reuses the same component, so it looks like nothing happened.
const EXCLUDED = ['/login', '/change-password']

/**
 * The only way a `?redirect=` value may reach router.push: a plain in-app path,
 * never another origin, never a page that would loop. Anything else is null.
 */
export function safeRedirect(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return null
  }

  const path = value.split(/[?#]/, 1)[0] ?? ''

  if (EXCLUDED.some((page) => path === page || path.startsWith(`${page}/`))) {
    return null
  }

  return value
}
