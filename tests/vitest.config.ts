/**
 * Vitest Configuration for E2E and Integration Tests
 *
 * This config is specifically for testing the Vite migration workflow.
 * It includes long timeouts for E2E tests that actually publish/install packages.
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Use Node environment for E2E tests (no jsdom needed)
    environment: 'node',

    // Globals for convenience
    globals: true,

    // Long timeouts for E2E tests (publish, install, build)
    testTimeout: 300000, // 5 minutes
    hookTimeout: 60000,  // 1 minute

    // Run tests sequentially for E2E (avoid port conflicts, etc.)
    // Set to false for faster unit tests
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Sequential execution
      },
    },

    // Test file patterns
    include: [
      '**/*.test.ts',
      '**/*.spec.ts',
    ],

    // Exclude patterns
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/temp/**',
      '**/fixtures/**',
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/temp/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/fixtures/**',
      ],
    },

    // Setup file for global test utilities
    setupFiles: [
      path.resolve(__dirname, 'setup.ts'),
    ],

    // Log level
    logHeapUsage: true,
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, '..'),
      '@tests': path.resolve(__dirname),
    },
  },
});
