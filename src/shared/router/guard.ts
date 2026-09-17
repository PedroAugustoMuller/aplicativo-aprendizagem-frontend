import type { RouteLocationNormalizedLoaded, RouteLocationRaw, Router } from 'vue-router'
import type { RestoreOutcome } from '@/modules/identity/application/sessionStore'

export interface RouteFlags {
  requiresAuth: boolean
  guestOnly: boolean
}

export interface SessionState {
  /** A token exists - confirmed by the server or not (e.g. an offline reload). */
  hasSession: boolean
  /** restore() just discarded a token the server rejected with a 401. */
  expired: boolean
}

/** The slice of the session store the guard and the 401 handler need. */
export interface GuardedSession {
  readonly token: string | null
  /** Only compared with null: the guard needs to know whether restore() is due. */
  readonly user: unknown
  readonly hasSession: boolean
  restore(): Promise<RestoreOutcome>
  clear(): void
}

/** Pure decision function, unit-testable without a router instance. */
export function resolveNavigation(
  flags: RouteFlags,
  session: SessionState,
  targetPath: string,
): true | RouteLocationRaw {
  if (flags.requiresAuth && !session.hasSession) {
    return {
      path: '/login',
      query: session.expired ? { redirect: targetPath, reason: 'expired' } : { redirect: targetPath },
    }
  }

  if (flags.guestOnly && session.hasSession) {
    return { path: '/topics' }
  }

  return true
}

/**
 * Where a 401 on an authenticated request should send the user, if anywhere.
 *
 * Only a user currently on a route that requires auth is sent away. On first
 * load the current route is START_LOCATION (no meta): the guard's restore() is
 * what hit the 401, and the guard alone owns that redirect - a second push from
 * here would race it.
 */
export function unauthorizedRedirect(current: Pick<RouteLocationNormalizedLoaded, 'meta'>): RouteLocationRaw | null {
  return current.meta.requiresAuth === true ? { path: '/login', query: { reason: 'expired' } } : null
}

/** The onUnauthorized hook the composition root hands to the HTTP transport. */
export function createUnauthorizedHandler(getSession: () => GuardedSession, router: Router): () => void {
  return () => {
    getSession().clear()

    const target = unauthorizedRedirect(router.currentRoute.value)

    if (target !== null) {
      void router.push(target)
    }
  }
}

export function installSessionGuard(router: Router, getSession: () => GuardedSession): void {
  router.beforeEach(async (to) => {
    const session = getSession()
    let expired = false

    // A page reload has a persisted token but no user yet. So does a session
    // whose earlier restore() could not reach the server: retry on navigation.
    if (session.token !== null && session.user === null) {
      expired = (await session.restore()) === 'rejected'
    }

    return resolveNavigation(
      { requiresAuth: to.meta.requiresAuth === true, guestOnly: to.meta.guestOnly === true },
      { hasSession: session.hasSession, expired },
      to.fullPath,
    )
  })
}
