import { createRouter, createWebHistory } from 'vue-router'
import { useSessionStore } from '@/modules/identity/application/sessionStore'
import { installSessionGuard } from '@/shared/router/guard'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/subjects' },
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
      meta: { requiresAuth: true, passwordChange: true },
    },
    {
      path: '/subjects',
      name: 'subjects',
      component: () => import('@/modules/content/presentation/SubjectsPage.vue'),
      meta: { requiresAuth: true },
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
      component: () => import('@/modules/identity/presentation/ClassroomPage.vue'),
      meta: { requiresAuth: true, roles: ['admin', 'teacher'] },
    },
    {
      path: '/classrooms/:classroomId/progress',
      name: 'classroom-progress',
      component: () => import('@/shared/ui/ClassroomProgressRoute.vue'),
      meta: { requiresAuth: true, roles: ['admin', 'teacher'] },
    },
    {
      path: '/classrooms/:classroomId/credentials',
      name: 'classroom-credentials',
      component: () => import('@/modules/identity/presentation/CredentialsPage.vue'),
      meta: { requiresAuth: true, roles: ['admin', 'teacher'] },
    },
    {
      path: '/subjects/:subjectId/topics',
      name: 'subject-topics',
      component: () => import('@/shared/ui/TopicsWithQuiz.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/subjects/:subjectId/topics/:topicId/questions',
      name: 'topic-questions',
      component: () => import('@/modules/content/presentation/QuestionsPage.vue'),
      meta: { requiresAuth: true, roles: ['admin', 'teacher'] },
    },
    {
      path: '/subjects/:subjectId/topics/:topicId/questions/new',
      name: 'question-new',
      component: () => import('@/modules/content/presentation/QuestionFormPage.vue'),
      meta: { requiresAuth: true, roles: ['admin', 'teacher'] },
    },
    {
      path: '/subjects/:subjectId/topics/:topicId/questions/:questionId/edit',
      name: 'question-edit',
      component: () => import('@/modules/content/presentation/QuestionFormPage.vue'),
      meta: { requiresAuth: true, roles: ['admin', 'teacher'] },
    },
    {
      path: '/subjects/:subjectId/topics/:topicId/progress',
      name: 'topic-progress',
      component: () => import('@/shared/ui/TopicProgressRoute.vue'),
      meta: { requiresAuth: true, roles: ['student'] },
    },
    {
      path: '/classrooms/:classroomId/students/:studentId/topics/:topicId/progress',
      name: 'student-topic-progress',
      component: () => import('@/shared/ui/TopicProgressRoute.vue'),
      meta: { requiresAuth: true, roles: ['admin', 'teacher'] },
    },
    {
      path: '/subjects/:subjectId/topics/:topicId/review',
      name: 'topic-wrong-questions',
      component: () => import('@/modules/quiz/presentation/WrongQuestionsPage.vue'),
      meta: { requiresAuth: true, roles: ['student'] },
    },
    {
      path: '/classrooms/:classroomId/students/:studentId/quiz/:attemptId/review',
      name: 'student-quiz-review',
      component: () => import('@/modules/quiz/presentation/AttemptReviewPage.vue'),
      meta: { requiresAuth: true, roles: ['admin', 'teacher'] },
    },
    {
      path: '/classrooms/:classroomId/students/:studentId/topics/:topicId/review',
      name: 'student-wrong-questions',
      component: () => import('@/modules/quiz/presentation/WrongQuestionsPage.vue'),
      meta: { requiresAuth: true, roles: ['admin', 'teacher'] },
    },
    {
      path: '/quiz/:attemptId/review',
      name: 'quiz-review',
      component: () => import('@/modules/quiz/presentation/AttemptReviewPage.vue'),
      meta: { requiresAuth: true, roles: ['student'] },
    },
    {
      path: '/quiz/:attemptId',
      name: 'quiz',
      component: () => import('@/modules/quiz/presentation/QuizPage.vue'),
      meta: { requiresAuth: true, roles: ['student'] },
    },
    { path: '/:pathMatch(.*)*', redirect: '/subjects' },
  ],
})

installSessionGuard(router, () => useSessionStore())
