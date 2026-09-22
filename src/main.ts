import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '@/App.vue'
import { vuetify } from '@/plugins/vuetify'
import { router } from '@/shared/router'
import { createUnauthorizedHandler } from '@/shared/router/guard'
import { i18n } from '@/shared/i18n'
import { configureApiSession } from '@/shared/api/client'
import { resetSharedStores } from '@/shared/ui/resetStores'
import { useSessionStore } from '@/modules/identity/application/sessionStore'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia).use(vuetify).use(i18n)

// The composition root - the only place that knows both HTTP and routing exist.
// This is what keeps the router out of the transport.
const session = useSessionStore(pinia)
const handleUnauthorized = createUnauthorizedHandler(() => session, router)

configureApiSession({
  getToken: () => session.token,
  // Always clears the session; navigates only when the current route requires
  // auth (see unauthorizedRedirect). On first load the guard owns the redirect.
  // Also clears the cached lists a second user on a shared phone must not inherit.
  onUnauthorized: () => {
    handleUnauthorized()
    resetSharedStores(pinia)
  },
})

app.use(router)
app.mount('#app')
