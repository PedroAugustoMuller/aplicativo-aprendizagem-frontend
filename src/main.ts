import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '@/App.vue'
import { vuetify } from '@/plugins/vuetify'
import { router } from '@/shared/router'
import { createUnauthorizedHandler } from '@/shared/router/guard'
import { i18n } from '@/shared/i18n'
import { configureApiSession } from '@/shared/api/client'
import { configureOffline } from '@/shared/offline/readThrough'
import { useSessionStore } from '@/modules/identity/application/sessionStore'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia).use(vuetify).use(i18n)

// The composition root - the only place that knows both HTTP and routing exist.
// This is what keeps the router out of the transport.
const session = useSessionStore(pinia)

configureApiSession({
  getToken: () => session.token,
  // Always clears the session; navigates only when the current route requires
  // auth (see unauthorizedRedirect). On first load the guard owns the redirect.
  onUnauthorized: createUnauthorizedHandler(() => session, router),
})

// Saved lists are per user, so the offline cache needs to know who is signed in.
configureOffline({ userId: () => session.knownUser?.userId ?? null })

app.use(router)
app.mount('#app')
