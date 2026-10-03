export const quizRoutes = {
  topicAttempts: '/topics/:topicId/quiz-attempts',
  attempt: '/quiz-attempts/:attemptId',
  attemptAnswers: '/quiz-attempts/:attemptId/answers',
} as const
