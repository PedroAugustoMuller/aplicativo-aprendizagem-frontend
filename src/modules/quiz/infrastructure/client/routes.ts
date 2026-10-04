export const quizRoutes = {
  topicAttempts: '/topics/:topicId/quiz-attempts',
  attempt: '/quiz-attempts/:attemptId',
  attemptAnswers: '/quiz-attempts/:attemptId/answers',
  subjectProgress: '/subjects/:subjectId/quiz-progress',
  topicHistory: '/topics/:topicId/quiz-history',
  wrongQuestions: '/topics/:topicId/wrong-questions',
  classroomProgress: '/classrooms/:classroomId/quiz-progress',
  studentTopicHistory: '/classrooms/:classroomId/students/:studentId/topics/:topicId/quiz-history',
  studentWrongQuestions: '/classrooms/:classroomId/students/:studentId/topics/:topicId/wrong-questions',
  studentAttempt: '/classrooms/:classroomId/students/:studentId/quiz-attempts/:attemptId',
} as const
