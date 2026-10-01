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
