import { createRouter, createWebHistory } from 'vue-router'
import { useSessionStore } from '@/modules/identity/application/sessionStore'
import { installSessionGuard } from '@/shared/router/guard'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/topics' },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/modules/identity/presentation/LoginPage.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/topics',
      name: 'topics',
      component: () => import('@/modules/content/presentation/TopicsPage.vue'),
      meta: { requiresAuth: true },
    },
    { path: '/:pathMatch(.*)*', redirect: '/topics' },
  ],
})

installSessionGuard(router, () => useSessionStore())
