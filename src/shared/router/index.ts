import { createRouter, createWebHistory } from 'vue-router'
import { useSessionStore } from '@/modules/identity/application/sessionStore'
import { installSessionGuard } from '@/shared/router/guard'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/shared/ui/HomeRedirectPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/modules/identity/presentation/LoginPage.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/change-password',
      name: 'change-password',
      component: () => import('@/modules/identity/presentation/ChangePasswordPage.vue'),
      meta: { requiresAuth: true, allowsPendingPassword: true },
    },
    {
      path: '/subjects',
      name: 'subjects',
      component: () => import('@/modules/content/presentation/SubjectsPage.vue'),
      meta: { requiresAuth: true, roles: ['admin'] },
    },
    {
      path: '/teachers',
      name: 'teachers',
      component: () => import('@/modules/identity/presentation/TeachersPage.vue'),
      meta: { requiresAuth: true, roles: ['admin'] },
    },
    {
      path: '/classrooms',
      name: 'classrooms',
      component: () => import('@/modules/identity/presentation/ClassroomsPage.vue'),
      meta: { requiresAuth: true, roles: ['admin', 'teacher'] },
    },
    {
      path: '/classrooms/:classroomId',
      name: 'classroom',
      component: () => import('@/modules/identity/presentation/ClassroomDetailPage.vue'),
      meta: { requiresAuth: true, roles: ['admin', 'teacher'] },
    },
    {
      path: '/classrooms/:classroomId/credentials',
      name: 'classroom-credentials',
      component: () => import('@/modules/identity/presentation/CredentialSlipsPage.vue'),
      meta: { requiresAuth: true, roles: ['admin', 'teacher'] },
    },
    {
      path: '/my-classrooms',
      name: 'my-classrooms',
      component: () => import('@/modules/identity/presentation/MyClassroomsPage.vue'),
      meta: { requiresAuth: true, roles: ['student'] },
    },
    {
      path: '/subjects/:subjectId/topics',
      name: 'topics',
      component: () => import('@/modules/content/presentation/TopicsPage.vue'),
      meta: { requiresAuth: true },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

installSessionGuard(router, () => useSessionStore())
