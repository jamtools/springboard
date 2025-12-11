/**
 * Global test setup
 * Runs before all tests
 */

import { afterAll, beforeAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

// Extend global with test-specific properties
declare global {
  // eslint-disable-next-line no-var
  var __TEST_TEMP_ROOT__: string | undefined;
}

// Root directory for all test temp files
const TEST_TEMP_ROOT = path.join(process.cwd(), 'tests', 'temp');

// Global setup
beforeAll(async () => {
  console.log('[Setup] Initializing test environment...');

  // Create temp directory for tests
  await fs.mkdir(TEST_TEMP_ROOT, { recursive: true });

  // Store in global for access in tests
  globalThis.__TEST_TEMP_ROOT__ = TEST_TEMP_ROOT;

  console.log(`[Setup] Temp directory: ${TEST_TEMP_ROOT}`);
});

// Global cleanup
afterAll(async () => {
  console.log('[Cleanup] Test environment...');

  // Clean up temp directory (optional - keep for debugging)
  if (process.env.KEEP_TEST_ARTIFACTS !== 'true') {
    try {
      await fs.rm(TEST_TEMP_ROOT, { recursive: true, force: true });
      console.log('[Cleanup] Removed temp directory');
    } catch (error) {
      console.warn('[Cleanup] Failed to remove temp directory:', error);
    }
  } else {
    console.log(`[Cleanup] Keeping test artifacts at: ${TEST_TEMP_ROOT}`);
  }
});

// Helper to get temp root
export function getTestTempRoot(): string {
  return globalThis.__TEST_TEMP_ROOT__ || TEST_TEMP_ROOT;
}
