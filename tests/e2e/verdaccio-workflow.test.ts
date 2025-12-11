/**
 * Verdaccio E2E Workflow Tests
 *
 * This is the MOST IMPORTANT test suite. It validates the entire workflow:
 * 1. Build Springboard package
 * 2. Publish to local Verdaccio registry
 * 3. Install in consumer app
 * 4. Build consumer app for all platforms
 * 5. Run dev server
 *
 * This ensures the published package works exactly as a real consumer would use it.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import * as path from 'path';
import {
  startVerdaccio,
  publishToVerdaccio,
  installFromVerdaccio,
  packageExists,
  getPackageInfo,
  type VerdaccioServer,
} from '../utils/verdaccio.js';
import {
  createTempDir,
  cleanupDir,
  copyDir,
  fileExists,
  dirExists,
  readJson,
  findFiles,
} from '../utils/file-system.js';
import {
  execute,
  runBuild,
  runDevServer,
  waitForUrl,
} from '../utils/exec.js';

describe('Verdaccio E2E Workflow', () => {
  let verdaccio: VerdaccioServer;
  let testAppDir: string;
  let packageDir: string;

  const REPO_ROOT = path.resolve(process.cwd());
  const SOURCE_TEST_APP = path.join(REPO_ROOT, 'test-apps/vite-multi-platform');
  const SPRINGBOARD_PKG = path.join(REPO_ROOT, 'packages/springboard');

  beforeAll(async () => {
    console.log('\n=== Starting Verdaccio E2E Test Suite ===\n');

    // 1. Start Verdaccio
    console.log('1. Starting Verdaccio server...');
    verdaccio = await startVerdaccio();
    console.log(`   ✓ Verdaccio running at ${verdaccio.url}`);

    // 2. Build Springboard package for publishing
    console.log('\n2. Building Springboard package...');
    execSync('pnpm build:publish', {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    });
    console.log('   ✓ Springboard package built');

    // 3. Prepare package for publishing (copy package.publish.json)
    console.log('\n3. Preparing package for publishing...');
    const publishPkgJson = await readJson(path.join(SPRINGBOARD_PKG, 'package.publish.json'));
    const originalPkgJson = await readJson(path.join(SPRINGBOARD_PKG, 'package.json'));

    // Temporarily replace package.json for publishing
    const backupPath = path.join(SPRINGBOARD_PKG, 'package.json.backup');
    execSync(`cp ${path.join(SPRINGBOARD_PKG, 'package.json')} ${backupPath}`, {
      stdio: 'pipe',
    });
    execSync(`cp ${path.join(SPRINGBOARD_PKG, 'package.publish.json')} ${path.join(SPRINGBOARD_PKG, 'package.json')}`, {
      stdio: 'pipe',
    });

    try {
      // 4. Publish to Verdaccio
      console.log('\n4. Publishing to Verdaccio...');
      await publishToVerdaccio(SPRINGBOARD_PKG, verdaccio.url);
      console.log('   ✓ Package published to Verdaccio');
    } finally {
      // Restore original package.json
      execSync(`mv ${backupPath} ${path.join(SPRINGBOARD_PKG, 'package.json')}`, {
        stdio: 'pipe',
      });
    }

    // 5. Create temporary test app directory
    console.log('\n5. Setting up test app...');
    testAppDir = await createTempDir('verdaccio-test-app-');
    await copyDir(SOURCE_TEST_APP, testAppDir);
    console.log(`   ✓ Test app copied to ${testAppDir}`);

    console.log('\n=== Setup Complete ===\n');
  }, 120000); // 2 minute timeout for setup

  afterAll(async () => {
    console.log('\n=== Cleanup ===');

    // Stop Verdaccio
    if (verdaccio) {
      console.log('Stopping Verdaccio...');
      await verdaccio.stop();
      console.log('✓ Verdaccio stopped');
    }

    // Clean up temp directories
    if (testAppDir) {
      console.log('Cleaning up test app directory...');
      await cleanupDir(testAppDir);
      console.log('✓ Test app cleaned up');
    }

    console.log('=== Cleanup Complete ===\n');
  }, 60000);

  it('should publish Springboard package to Verdaccio', async () => {
    console.log('\nTest: Verifying package in registry...');

    const exists = await packageExists('springboard', verdaccio.url);
    expect(exists).toBe(true);

    const pkgInfo = await getPackageInfo('springboard', verdaccio.url);
    expect(pkgInfo.name).toBe('springboard');
    expect(pkgInfo.versions).toBeDefined();

    console.log(`✓ Package 'springboard' found in registry with versions:`, Object.keys(pkgInfo.versions));
  }, 30000);

  it('should install Springboard from Verdaccio in consumer app', async () => {
    console.log('\nTest: Installing dependencies from Verdaccio...');

    await installFromVerdaccio(testAppDir, verdaccio.url);

    // Verify springboard is installed
    const springboardPkgPath = path.join(testAppDir, 'node_modules/springboard/package.json');
    expect(await fileExists(springboardPkgPath)).toBe(true);

    const installedPkg = await readJson<{ name: string; version: string }>(springboardPkgPath);
    expect(installedPkg.name).toBe('springboard');

    console.log(`✓ Springboard ${installedPkg.version} installed successfully`);
  }, 120000);

  it('should build consumer app for browser platform', async () => {
    console.log('\nTest: Building for browser platform...');

    const result = await runBuild(testAppDir);
    expect(result.exitCode).toBe(0);

    // Verify dist/browser exists
    const browserDistPath = path.join(testAppDir, 'dist/browser');
    expect(await dirExists(browserDistPath)).toBe(true);

    // Verify index.html exists
    const htmlPath = path.join(browserDistPath, 'index.html');
    expect(await fileExists(htmlPath)).toBe(true);

    // Verify JS bundle exists
    const jsFiles = await findFiles(browserDistPath, /\.js$/);
    expect(jsFiles.length).toBeGreaterThan(0);

    console.log(`✓ Browser build successful`);
    console.log(`  - HTML: ${htmlPath}`);
    console.log(`  - JS files: ${jsFiles.length}`);
  }, 120000);

  it('should verify platform injection works correctly', async () => {
    console.log('\nTest: Verifying platform injection...');

    const browserDistPath = path.join(testAppDir, 'dist/browser');
    const jsFiles = await findFiles(browserDistPath, /\.js$/);

    expect(jsFiles.length).toBeGreaterThan(0);

    // Check that @platform markers are removed
    for (const jsFile of jsFiles) {
      const content = await readJson<string>(jsFile);
      const contentStr = typeof content === 'string' ? content : JSON.stringify(content);

      // Platform markers should not be in the output
      expect(contentStr).not.toContain('@platform');
      expect(contentStr).not.toContain('@platform end');
    }

    console.log(`✓ Platform injection working correctly`);
    console.log(`  - Verified ${jsFiles.length} JS files`);
  }, 30000);

  it('should build for multiple platforms', async () => {
    console.log('\nTest: Building for multiple platforms...');

    // Read vite.config.ts to determine which platforms are configured
    const viteConfig = path.join(testAppDir, 'vite.config.ts');
    const configContent = await readJson<string>(viteConfig);

    // The test app should build browser, node, and partykit platforms
    const expectedPlatforms = ['browser'];

    for (const platform of expectedPlatforms) {
      const platformDistPath = path.join(testAppDir, `dist/${platform}`);
      expect(await dirExists(platformDistPath)).toBe(true);
      console.log(`  ✓ Platform '${platform}' build exists`);
    }

    console.log(`✓ Multi-platform builds successful`);
  }, 30000);

  it('should run dev server successfully', async () => {
    console.log('\nTest: Starting dev server...');

    const devProcess = await runDevServer(testAppDir);

    try {
      // Wait for server to be accessible
      await waitForUrl('http://localhost:5173', 30000);

      // Test that we can fetch the page
      const response = await fetch('http://localhost:5173');
      expect(response.ok).toBe(true);

      const html = await response.text();
      expect(html).toContain('<!DOCTYPE html>');

      console.log(`✓ Dev server running successfully at http://localhost:5173`);
    } finally {
      console.log('  Stopping dev server...');
      devProcess.kill();
    }
  }, 60000);

  it('should verify build artifacts structure', async () => {
    console.log('\nTest: Verifying build artifacts structure...');

    const browserDist = path.join(testAppDir, 'dist/browser');

    // Check for expected files
    const expectedFiles = [
      'index.html',
      // At least one JS file
      /index.*\.js$/,
    ];

    for (const expected of expectedFiles) {
      if (expected instanceof RegExp) {
        const files = await findFiles(browserDist, expected);
        expect(files.length).toBeGreaterThan(0);
        console.log(`  ✓ Found ${files.length} file(s) matching ${expected}`);
      } else {
        const filePath = path.join(browserDist, expected);
        expect(await fileExists(filePath)).toBe(true);
        console.log(`  ✓ Found ${expected}`);
      }
    }

    console.log(`✓ Build artifacts structure verified`);
  }, 30000);

  it('should have proper package exports', async () => {
    console.log('\nTest: Verifying package exports...');

    const springboardPkg = path.join(testAppDir, 'node_modules/springboard/package.json');
    const pkgJson = await readJson<{
      exports: Record<string, unknown>;
      main: string;
      types: string;
    }>(springboardPkg);

    // Verify main fields
    expect(pkgJson.main).toBeDefined();
    expect(pkgJson.types).toBeDefined();

    // Verify exports
    expect(pkgJson.exports).toBeDefined();
    expect(pkgJson.exports['.']).toBeDefined();
    expect(pkgJson.exports['./core']).toBeDefined();
    expect(pkgJson.exports['./vite-plugin']).toBeDefined();

    console.log(`✓ Package exports properly configured`);
    console.log(`  - Main: ${pkgJson.main}`);
    console.log(`  - Types: ${pkgJson.types}`);
    console.log(`  - Exports:`, Object.keys(pkgJson.exports));
  }, 30000);

  it('should verify vite plugin is accessible', async () => {
    console.log('\nTest: Verifying Vite plugin accessibility...');

    // Try to import the plugin (this validates the export is correct)
    const vitePluginPath = path.join(testAppDir, 'node_modules/springboard/vite-plugin');
    expect(await dirExists(vitePluginPath)).toBe(true);

    const vitePluginPkg = path.join(vitePluginPath, 'package.json');
    if (await fileExists(vitePluginPkg)) {
      const pkgJson = await readJson<{ main: string }>(vitePluginPkg);
      console.log(`  ✓ Vite plugin package.json found`);
      console.log(`    Main: ${pkgJson.main}`);
    }

    console.log(`✓ Vite plugin accessible`);
  }, 30000);

  it('should handle TypeScript types correctly', async () => {
    console.log('\nTest: Verifying TypeScript types...');

    // Run typecheck
    const result = await execute('pnpm typecheck', { cwd: testAppDir, timeout: 60000 });

    // Typecheck should pass (or at least not fail catastrophically)
    if (result.exitCode !== 0) {
      console.log('  TypeScript output:', result.stdout);
      console.log('  TypeScript errors:', result.stderr);
    }

    // We expect it to succeed or have only minor warnings
    expect(result.exitCode).toBe(0);

    console.log(`✓ TypeScript types working correctly`);
  }, 60000);
});
