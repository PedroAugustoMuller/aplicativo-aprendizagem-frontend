import { mdiAccountTie, mdiBookOpenVariant, mdiGoogleClassroom } from '@mdi/js'

export interface NavItem {
  key: 'subjects' | 'classrooms' | 'teachers'
  icon: string
  to: string
}

// Mirrors the backend's permissions; hiding an entry is convenience, not security.
const AREAS: readonly (NavItem & { roles: readonly string[] })[] = [
  { key: 'subjects', icon: mdiBookOpenVariant, to: '/subjects', roles: ['admin', 'teacher', 'student'] },
  { key: 'classrooms', icon: mdiGoogleClassroom, to: '/classrooms', roles: ['admin', 'teacher'] },
  { key: 'teachers', icon: mdiAccountTie, to: '/teachers', roles: ['admin'] },
]

export function navItemsFor(role: string | null): NavItem[] {
  return AREAS
    .filter((area) => (role === null ? area.key === 'subjects' : area.roles.includes(role)))
    .map((area) => ({ key: area.key, icon: area.icon, to: area.to }))
}
