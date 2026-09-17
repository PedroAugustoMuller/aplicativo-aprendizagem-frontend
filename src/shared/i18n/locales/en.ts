export default {
  app: {
    name: 'Chemistry 9th Grade',
    tagline: 'Study chemistry by answering quizzes',
  },
  nav: {
    topics: 'Topics',
    signOut: 'Sign out',
    theme: 'Theme',
  },
  common: {
    retry: 'Try again',
    loading: 'Loading…',
    empty: 'Nothing here yet.',
  },
  auth: {
    title: 'Sign in',
    email: 'Email',
    password: 'Password',
    submit: 'Sign in',
    signedOut: 'Your session expired. Sign in again.',
  },
  topics: {
    title: 'Chemistry Topics',
    empty: 'No topics registered yet.',
  },
  errors: {
    api: {
      network_unavailable: 'No internet connection. Check your network and try again.',
      request_timeout: 'The server took too long to respond. Try again.',
      unexpected_response: 'Unexpected response from the server. Try again shortly.',
    },
    system: {
      unexpected_error: 'Something went wrong on our end. Try again shortly.',
    },
    auth: {
      unauthenticated: 'You need to sign in to continue.',
      forbidden: 'You do not have permission to do that.',
    },
    http: {
      error: 'The operation could not be completed. Try again.',
      not_found: 'We could not find what you are looking for.',
      method_not_allowed: 'This operation is not allowed here.',
      too_many_requests: 'Too many attempts in a row. Wait a minute and try again.',
    },
    validation: {
      failed: 'Check the highlighted fields.',
      invalid: 'Invalid value.',
      required: 'Required field.',
      email: 'Enter a valid email address.',
      max: 'Maximum of {arg0} characters.',
      min: 'Minimum of {arg0} characters.',
      string: 'Invalid value.',
    },
    identity: {
      invalid_credentials: 'Incorrect email or password.',
    },
  },
}
