export default {
  app: {
    name: 'Quiz Dom Pedro II',
    tagline: 'Study by answering quizzes',
  },
  nav: {
    subjects: 'Subjects',
    classrooms: 'Classes',
    teachers: 'Teachers',
    signOut: 'Sign out',
    theme: 'Theme',
  },
  common: {
    retry: 'Try again',
    loading: 'Loading…',
    empty: 'Nothing here yet.',
    cancel: 'Cancel',
    close: 'Close',
    save: 'Save',
  },
  auth: {
    title: 'Sign in',
    login: 'Email or username',
    password: 'Password',
    submit: 'Sign in',
    signedOut: 'Your session expired. Sign in again.',
  },
  password: {
    title: 'Change password',
    required: 'Create a new password to continue.',
    current: 'Current password',
    new: 'New password',
    confirm: 'Confirm the new password',
    submit: 'Save new password',
    tooShort: 'The new password must be at least {min} characters long.',
    mismatch: 'The passwords do not match.',
  },
  subjects: {
    title: 'Subjects',
    empty: 'No subjects available yet.',
    inactive: 'Inactive',
  },
  topics: {
    fallbackTitle: 'Topics',
    empty: 'No topics registered yet.',
    back: 'Subjects',
  },
  offline: {
    banner: 'Offline — showing data saved at {time}.',
    writeDisabled: 'Only available when online',
  },
  errors: {
    api: {
      network_unavailable: 'No internet connection. Check your network and try again.',
      request_timeout: 'The server took too long to respond. Try again.',
      unexpected_response: 'Unexpected response from the server. Try again shortly.',
    },
    system: {
      unexpected_error: 'Something went wrong on our end. Try again shortly.',
      idempotency_conflict: 'This operation conflicts with an earlier one. Reload the page and try again.',
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
      different: 'The new password must be different from the current one.',
    },
    content: {
      subject: {
        name_already_taken: 'A subject with this name already exists.',
      },
      subject_not_found: 'Subject not found.',
    },
    identity: {
      invalid_credentials: 'Incorrect email/username or password.',
      account_deactivated: 'This account has been deactivated. Talk to the school.',
      current_password_invalid: 'The current password is incorrect.',
      email_already_taken: 'This email is already in use.',
      password_change_required: 'You need to change your password before continuing.',
      student_not_found: 'Student not found.',
      teacher_not_found: 'Teacher not found.',
      classroom_not_found: 'Class not found.',
      classroom: {
        enrolment_requires_active_student: 'Only active students can be enrolled.',
        name_already_taken: 'A class with this name already exists.',
        subject_inactive: "This class's subject is inactive.",
      },
    },
  },
}
