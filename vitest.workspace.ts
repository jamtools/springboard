import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  // E2E tests (root level)
  "./vitest.config.ts",
  // Package tests
  "./configs/vite.config.ts",
  "./packages/jamtools/core/vite.config.ts",
])
