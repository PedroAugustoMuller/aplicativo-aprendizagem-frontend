import { computed, type ComputedRef } from 'vue'

// Wired once in main.ts from the session store, so a module (content) can adapt
// its page to the viewer's role without importing another module (identity).
let source: () => string | null = () => null

export function configureViewer(role: () => string | null): void {
  source = role
}

export function useViewerRole(): ComputedRef<string | null> {
  return computed(() => source())
}

// Same wiring for the viewer's id: quiz state on the device is kept per user, and
// the quiz module must not import identity to know who that is.
let idSource: () => string | null = () => null

export function configureViewerId(id: () => string | null): void {
  idSource = id
}

export function viewerId(): string | null {
  return idSource()
}
