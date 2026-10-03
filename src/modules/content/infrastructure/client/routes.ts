export const contentRoutes = {
  subjects: '/subjects',
  subject: '/subjects/:subjectId',
  subjectDeactivate: '/subjects/:subjectId/deactivate',
  subjectTopics: '/subjects/:subjectId/topics',
  subjectTopicOrder: '/subjects/:subjectId/topics/order',
  topic: '/topics/:topicId',
  topicDeactivate: '/topics/:topicId/deactivate',
  topicReactivate: '/topics/:topicId/reactivate',
  topicQuestions: '/topics/:topicId/questions',
  question: '/questions/:questionId',
  questionDeactivate: '/questions/:questionId/deactivate',
  questionReactivate: '/questions/:questionId/reactivate',
} as const
