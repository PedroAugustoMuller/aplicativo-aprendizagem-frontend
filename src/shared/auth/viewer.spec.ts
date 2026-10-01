import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { configureViewer, useViewerRole } from '@/shared/auth/viewer'

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
