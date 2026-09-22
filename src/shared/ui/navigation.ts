import { mdiAccountTie, mdiBookOpenVariant, mdiGoogleClassroom } from '@mdi/js'
import type { Role } from '@/modules/identity/application/sessionStore'

export interface NavItem {
  readonly titleKey: string
  readonly icon: string
  readonly to: string
  readonly testId: string
}

const CLASSROOMS: NavItem = { titleKey: 'nav.classrooms', icon: mdiGoogleClassroom, to: '/classrooms', testId: 'nav-classrooms' }
const TEACHERS: NavItem = { titleKey: 'nav.teachers', icon: mdiAccountTie, to: '/teachers', testId: 'nav-teachers' }
const SUBJECTS: NavItem = { titleKey: 'nav.subjects', icon: mdiBookOpenVariant, to: '/subjects', testId: 'nav-subjects' }
const MY_CLASSROOMS: NavItem = { titleKey: 'nav.myClassrooms', icon: mdiGoogleClassroom, to: '/my-classrooms', testId: 'nav-my-classrooms' }

export function navigationFor(role: Role | null): NavItem[] {
  switch (role) {
    case 'admin':
      return [CLASSROOMS, TEACHERS, SUBJECTS]
    case 'teacher':
      return [CLASSROOMS]
    case 'student':
      return [MY_CLASSROOMS]
    default:
      return []
  }
}
