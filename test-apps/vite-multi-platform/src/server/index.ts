/**
 * Node.js Server Platform Entry Point
 *
 * This file tests that Vite can properly:
 * 1. Build for Node.js target
 * 2. Resolve node-specific export conditions
 * 3. Import server-side springboard packages
 * 4. Handle ESM modules correctly
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';

// Test: Import from main springboard package
import springboard from 'springboard';

// Test: Import server-specific package (now from springboard/server)
import serverRegistry from 'springboard/server';

// Test: Import node platform (now from springboard/platforms/node)
import { startNodeApp } from 'springboard/platforms/node';

// Test: Import types
import type { CoreDependencies } from 'springboard/types/module_types';

// Test results storage
const testResults: Record<string, 'OK' | 'FAIL'> = {};

// Run export tests
function runExportTests(): void {
  console.log('\n=== Springboard Vite Test - Node.js Server Platform ===\n');

  // Test springboard default export
  testResults['springboard default'] = typeof springboard === 'object' ? 'OK' : 'FAIL';
  console.log(`springboard default: ${testResults['springboard default']}`);

  // Test server registry
  testResults['springboard-server'] = typeof serverRegistry === 'object' ? 'OK' : 'FAIL';
  console.log(`springboard-server: ${testResults['springboard-server']}`);

  // Test node platform export
  testResults['startNodeApp function'] = typeof startNodeApp === 'function' ? 'OK' : 'FAIL';
  console.log(`startNodeApp function: ${testResults['startNodeApp function']}`);

  // Summary
  const passed = Object.values(testResults).filter(v => v === 'OK').length;
  const total = Object.keys(testResults).length;
  console.log(`\n=== Results: ${passed}/${total} tests passed ===\n`);
}

// Create Hono app for health check
const app = new Hono();

app.get('/', (c) => {
  return c.json({
    message: 'Springboard Vite Test Server',
    platform: 'node',
    tests: testResults,
  });
});

app.get('/health', (c) => {
  const allPassed = Object.values(testResults).every(v => v === 'OK');
  return c.json({
    status: allPassed ? 'healthy' : 'unhealthy',
    tests: testResults,
  });
});

// Main entry point
async function main(): Promise<void> {
  // Run tests
  runExportTests();

  // Start server
  const port = parseInt(process.env.PORT || '3001', 10);

  console.log(`Starting server on port ${port}...`);

  serve({
    fetch: app.fetch,
    port,
  });

  console.log(`Server running at http://localhost:${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
}

// Export for testing
export { testResults, runExportTests };

// Run if executed directly
main().catch(console.error);
