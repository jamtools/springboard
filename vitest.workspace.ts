import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // E2E tests (root level)
  './vitest.config.ts',
  // Package tests
  './packages/jamtools/core/vite.config.ts',
  './packages/springboard/vite.config.ts',
]);
