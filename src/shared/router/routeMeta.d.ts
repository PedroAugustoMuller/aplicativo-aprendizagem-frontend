import 'vue-router'
import type { Role } from '@/modules/identity/application/sessionStore'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guestOnly?: boolean
    roles?: readonly Role[]
    allowsPendingPassword?: boolean
  }
}
