import type { Pinia } from 'pinia'
import { useSubjectStore } from '@/modules/content/application/subjectStore'
import { useTopicStore } from '@/modules/content/application/topicStore'
import { useTeacherStore } from '@/modules/identity/application/teacherStore'
import { useClassroomStore } from '@/modules/identity/application/classroomStore'
import { useRosterStore } from '@/modules/identity/application/rosterStore'

/**
 * A second user signing in on the same shared phone must not see the first
 * user's cached lists. Called from AppLayout.signOut() and from main.ts's
 * onUnauthorized wiring - the two places a session ends. `pinia` is only
 * needed outside a component's setup context (main.ts calls this before the
 * app is mounted); a component call can omit it and rely on the active one.
 */
export function resetSharedStores(pinia?: Pinia): void {
  useSubjectStore(pinia).reset()
  useTopicStore(pinia).reset()
  useTeacherStore(pinia).reset()
  useClassroomStore(pinia).reset()
  useRosterStore(pinia).reset()
}
