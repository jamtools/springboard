import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Extended timeouts for E2E tests that build/publish packages
    testTimeout: 300000, // 5 minutes for E2E tests
    hookTimeout: 60000, // 1 minute for setup/teardown

    // Enable globals for simpler test syntax
    globals: true,

    // Test environment
    environment: 'node',

    // Include patterns
    include: ['tests/**/*.test.ts'],

    // Exclude patterns
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.git/**',
      '**/test-apps/**/node_modules/**',
      '**/test-apps/**/dist/**',
    ],

    // Reporter configuration
    reporters: ['verbose'],

    // Coverage configuration (optional)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'tests/**',
        '**/dist/**',
        '**/*.config.*',
        '**/scripts/**',
      ],
    },

    // Isolation and concurrency
    isolate: true,
    pool: 'forks', // Use forks for better isolation with file system operations
    poolOptions: {
      forks: {
        singleFork: true, // Run tests serially to avoid conflicts with Verdaccio
      },
    },
  },

  // Resolve configuration to help with imports
  resolve: {
    alias: {
      '@springboard/vite-plugin': path.resolve(__dirname, 'packages/springboard/vite-plugin/src'),
      '@test-utils': path.resolve(__dirname, 'tests/utils'),
    },
  },
});
