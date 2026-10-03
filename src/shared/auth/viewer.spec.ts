import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { configureViewer, configureViewerId, useViewerRole, viewerId } from '@/shared/auth/viewer'

describe('useViewerRole', () => {
  it('follows the configured source reactively', () => {
    const role = ref<string | null>('teacher')
    configureViewer(() => role.value)
    const viewer = useViewerRole()

    expect(viewer.value).toBe('teacher')
    role.value = 'admin'
    expect(viewer.value).toBe('admin')
  })
})

describe('viewerId', () => {
  it('reads the id wired by the composition root, live', () => {
    let id: string | null = null
    configureViewerId(() => id)

    expect(viewerId()).toBeNull()
    id = 'u-1'
    expect(viewerId()).toBe('u-1')
  })
})
