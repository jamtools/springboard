#!/usr/bin/env node

/**
 * Export Resolution Test Script
 *
 * This script verifies that all Springboard package exports
 * resolve correctly when installed from Verdaccio.
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

function test(name, fn) {
  try {
    fn();
    results.passed++;
    results.tests.push({ name, status: 'PASS' });
    console.log(`  [PASS] ${name}`);
  } catch (error) {
    results.failed++;
    results.tests.push({ name, status: 'FAIL', error: error.message });
    console.log(`  [FAIL] ${name}: ${error.message}`);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    results.passed++;
    results.tests.push({ name, status: 'PASS' });
    console.log(`  [PASS] ${name}`);
  } catch (error) {
    results.failed++;
    results.tests.push({ name, status: 'FAIL', error: error.message });
    console.log(`  [FAIL] ${name}: ${error.message}`);
  }
}

async function runTests() {
  console.log('\n=== Springboard Export Resolution Tests ===\n');

  // Test 1: Main springboard package
  console.log('Testing: springboard');
  await testAsync('springboard default import', async () => {
    const mod = await import('springboard');
    if (!mod.default) throw new Error('Missing default export');
  });

  // Test 2: springboard/engine/engine subpath
  console.log('\nTesting: springboard/engine/engine');
  await testAsync('springboard/engine/engine import', async () => {
    const mod = await import('springboard/engine/engine');
    if (!mod.Springboard) throw new Error('Missing Springboard class');
  });

  // Test 3: springboard/types/module_types subpath
  console.log('\nTesting: springboard/types/module_types');
  await testAsync('springboard/types/module_types import', async () => {
    // Types might not have runtime exports, just verify module resolves
    await import('springboard/types/module_types');
  });

  // Test 4: springboard-server package
  console.log('\nTesting: springboard-server');
  await testAsync('springboard-server default import', async () => {
    const mod = await import('springboard-server');
    if (!mod.default) throw new Error('Missing default export');
  });

  // Test 5: @springboardjs/platforms-browser
  console.log('\nTesting: @springboardjs/platforms-browser');
  await testAsync('@springboardjs/platforms-browser import', async () => {
    await import('@springboardjs/platforms-browser');
  });

  // Test 6: @springboardjs/platforms-node
  console.log('\nTesting: @springboardjs/platforms-node');
  await testAsync('@springboardjs/platforms-node import', async () => {
    await import('@springboardjs/platforms-node');
  });

  await testAsync('@springboardjs/platforms-node/entrypoints/main import', async () => {
    const mod = await import('@springboardjs/platforms-node/entrypoints/main');
    if (!mod.startNodeApp) throw new Error('Missing startNodeApp function');
  });

  // Test 7: @springboardjs/platforms-partykit
  console.log('\nTesting: @springboardjs/platforms-partykit');
  await testAsync('@springboardjs/platforms-partykit import', async () => {
    await import('@springboardjs/platforms-partykit');
  });

  // Test 8: @springboardjs/data-storage
  console.log('\nTesting: @springboardjs/data-storage');
  await testAsync('@springboardjs/data-storage import', async () => {
    await import('@springboardjs/data-storage');
  });

  // Test 9: Verify build outputs exist
  console.log('\nTesting: Build outputs');
  const browserDist = join(projectRoot, 'dist', 'browser');
  const serverDist = join(projectRoot, 'dist', 'server');

  test('Browser build output exists', () => {
    if (!fs.existsSync(browserDist)) {
      throw new Error(`Browser dist not found at ${browserDist}`);
    }
  });

  test('Server build output exists', () => {
    if (!fs.existsSync(serverDist)) {
      throw new Error(`Server dist not found at ${serverDist}`);
    }
  });

  // Print summary
  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Total:  ${results.passed + results.failed}`);

  // Exit with appropriate code
  if (results.failed > 0) {
    console.log('\n[ERROR] Some tests failed!');
    process.exit(1);
  } else {
    console.log('\n[SUCCESS] All tests passed!');
    process.exit(0);
  }
}

runTests().catch((error) => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
