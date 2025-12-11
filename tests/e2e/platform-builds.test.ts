/**
 * Platform-Specific Build Tests
 *
 * Tests building for each individual platform to ensure proper configuration,
 * output structure, and platform-specific features.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  createTempDir,
  cleanupDir,
  fileExists,
  dirExists,
  writeJson,
  readJson,
  findFiles,
} from '../utils/file-system.js';
import { execute, runBuild } from '../utils/exec.js';

describe('Platform-Specific Builds', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await createTempDir('platform-builds-test-');
  });

  afterAll(async () => {
    await cleanupDir(testDir);
  });

  describe('Browser Platform', () => {
    let browserAppDir: string;

    beforeAll(async () => {
      browserAppDir = path.join(testDir, 'browser-app');
      await fs.mkdir(browserAppDir, { recursive: true });

      // Create minimal browser app
      await createTestApp(browserAppDir, {
        platforms: ['browser'],
        entry: './src/index.tsx',
      });
    });

    it('should build browser platform with HTML output', async () => {
      const result = await runBuild(browserAppDir);
      expect(result.exitCode).toBe(0);

      // Verify dist/browser directory
      const distPath = path.join(browserAppDir, 'dist/browser');
      expect(await dirExists(distPath)).toBe(true);

      // Verify index.html
      const htmlPath = path.join(distPath, 'index.html');
      expect(await fileExists(htmlPath)).toBe(true);

      const html = await fs.readFile(htmlPath, 'utf8');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<script');
    });

    it('should generate proper browser bundle', async () => {
      const distPath = path.join(browserAppDir, 'dist/browser');
      const jsFiles = await findFiles(distPath, /\.js$/);

      expect(jsFiles.length).toBeGreaterThan(0);

      // Check that bundles use ES modules
      for (const jsFile of jsFiles) {
        const content = await fs.readFile(jsFile, 'utf8');
        // Should have import/export or module syntax
        expect(
          content.includes('import') ||
          content.includes('export') ||
          content.includes('__vite')
        ).toBe(true);
      }
    });

    it('should inject browser-specific code only', async () => {
      const distPath = path.join(browserAppDir, 'dist/browser');
      const jsFiles = await findFiles(distPath, /\.js$/);

      for (const jsFile of jsFiles) {
        const content = await fs.readFile(jsFile, 'utf8');

        // Should not contain platform markers
        expect(content).not.toContain('@platform');
        expect(content).not.toContain('@platform end');
      }
    });
  });

  describe('Node Platform', () => {
    let nodeAppDir: string;

    beforeAll(async () => {
      nodeAppDir = path.join(testDir, 'node-app');
      await fs.mkdir(nodeAppDir, { recursive: true });

      // Create minimal node app
      await createTestApp(nodeAppDir, {
        platforms: ['node'],
        entry: './src/index.tsx',
      });
    });

    it('should build node platform with SSR configuration', async () => {
      const result = await runBuild(nodeAppDir);
      expect(result.exitCode).toBe(0);

      // Verify dist/node directory
      const distPath = path.join(nodeAppDir, 'dist/node');
      expect(await dirExists(distPath)).toBe(true);

      // Should have server entry
      const jsFiles = await findFiles(distPath, /\.js$/);
      expect(jsFiles.length).toBeGreaterThan(0);
    });

    it('should generate Node.js compatible output', async () => {
      const distPath = path.join(nodeAppDir, 'dist/node');
      const jsFiles = await findFiles(distPath, /\.js$/);

      for (const jsFile of jsFiles) {
        const content = await fs.readFile(jsFile, 'utf8');

        // Should be ES modules (since we're using type: module)
        expect(
          content.includes('import') ||
          content.includes('export') ||
          content.includes('require')
        ).toBe(true);
      }
    });

    it('should inject node-specific code only', async () => {
      const distPath = path.join(nodeAppDir, 'dist/node');
      const jsFiles = await findFiles(distPath, /\.js$/);

      for (const jsFile of jsFiles) {
        const content = await fs.readFile(jsFile, 'utf8');

        // Should not contain platform markers
        expect(content).not.toContain('@platform');
        expect(content).not.toContain('@platform end');
      }
    });
  });

  describe('PartyKit Platform', () => {
    let partykitAppDir: string;

    beforeAll(async () => {
      partykitAppDir = path.join(testDir, 'partykit-app');
      await fs.mkdir(partykitAppDir, { recursive: true });

      // Create minimal partykit app
      await createTestApp(partykitAppDir, {
        platforms: ['partykit'],
        entry: './src/index.tsx',
        partykitName: 'test-party',
      });
    });

    it('should build partykit platform for workerd runtime', async () => {
      const result = await runBuild(partykitAppDir);
      expect(result.exitCode).toBe(0);

      // Verify dist/partykit directory
      const distPath = path.join(partykitAppDir, 'dist/partykit');
      expect(await dirExists(distPath)).toBe(true);
    });

    it('should generate workerd-compatible output', async () => {
      const distPath = path.join(partykitAppDir, 'dist/partykit');
      const jsFiles = await findFiles(distPath, /\.js$/);

      expect(jsFiles.length).toBeGreaterThan(0);

      // Check for fetch-based APIs (workerd uses fetch)
      for (const jsFile of jsFiles) {
        const content = await fs.readFile(jsFile, 'utf8');

        // Should be compatible with workerd (no node-specific APIs)
        expect(content).not.toContain('require(');
        expect(content).not.toContain('process.env');
      }
    });

    it('should inject fetch-platform code', async () => {
      const distPath = path.join(partykitAppDir, 'dist/partykit');
      const jsFiles = await findFiles(distPath, /\.js$/);

      for (const jsFile of jsFiles) {
        const content = await fs.readFile(jsFile, 'utf8');

        // Should not contain platform markers
        expect(content).not.toContain('@platform');
        expect(content).not.toContain('@platform end');
      }
    });
  });

  describe('Tauri Platform', () => {
    let tauriAppDir: string;

    beforeAll(async () => {
      tauriAppDir = path.join(testDir, 'tauri-app');
      await fs.mkdir(tauriAppDir, { recursive: true });

      // Create minimal tauri app
      await createTestApp(tauriAppDir, {
        platforms: ['tauri'],
        entry: './src/index.tsx',
      });
    });

    it('should build tauri platform (browser-based)', async () => {
      const result = await runBuild(tauriAppDir);
      expect(result.exitCode).toBe(0);

      // Tauri uses browser build
      const distPath = path.join(tauriAppDir, 'dist/tauri');
      expect(await dirExists(distPath)).toBe(true);
    });

    it('should generate browser-compatible output for Tauri', async () => {
      const distPath = path.join(tauriAppDir, 'dist/tauri');
      const jsFiles = await findFiles(distPath, /\.js$/);

      expect(jsFiles.length).toBeGreaterThan(0);
    });
  });

  describe('React Native Platform', () => {
    let rnAppDir: string;

    beforeAll(async () => {
      rnAppDir = path.join(testDir, 'rn-app');
      await fs.mkdir(rnAppDir, { recursive: true });

      // Create minimal React Native app
      await createTestApp(rnAppDir, {
        platforms: ['react-native'],
        entry: './src/index.tsx',
      });
    });

    it('should build react-native platform', async () => {
      const result = await runBuild(rnAppDir);
      expect(result.exitCode).toBe(0);

      // Verify dist/react-native directory
      const distPath = path.join(rnAppDir, 'dist/react-native');
      expect(await dirExists(distPath)).toBe(true);
    });

    it('should inject react-native-specific code', async () => {
      const distPath = path.join(rnAppDir, 'dist/react-native');
      const jsFiles = await findFiles(distPath, /\.js$/);

      for (const jsFile of jsFiles) {
        const content = await fs.readFile(jsFile, 'utf8');

        // Should not contain platform markers
        expect(content).not.toContain('@platform');
        expect(content).not.toContain('@platform end');
      }
    });
  });

  describe('Multi-Platform Builds', () => {
    let multiAppDir: string;

    beforeAll(async () => {
      multiAppDir = path.join(testDir, 'multi-app');
      await fs.mkdir(multiAppDir, { recursive: true });

      // Create app that builds multiple platforms
      await createTestApp(multiAppDir, {
        platforms: ['browser', 'node'],
        entry: './src/index.tsx',
      });
    });

    it('should build multiple platforms in one command', async () => {
      const result = await runBuild(multiAppDir);
      expect(result.exitCode).toBe(0);

      // Both platforms should have outputs
      const browserDist = path.join(multiAppDir, 'dist/browser');
      const nodeDist = path.join(multiAppDir, 'dist/node');

      expect(await dirExists(browserDist)).toBe(true);
      expect(await dirExists(nodeDist)).toBe(true);
    });

    it('should generate platform-specific code for each platform', async () => {
      const browserDist = path.join(multiAppDir, 'dist/browser');
      const nodeDist = path.join(multiAppDir, 'dist/node');

      // Both should have JS files
      const browserJs = await findFiles(browserDist, /\.js$/);
      const nodeJs = await findFiles(nodeDist, /\.js$/);

      expect(browserJs.length).toBeGreaterThan(0);
      expect(nodeJs.length).toBeGreaterThan(0);
    });
  });
});

/**
 * Helper to create a minimal test app
 */
async function createTestApp(
  dir: string,
  config: {
    platforms: string[];
    entry: string;
    partykitName?: string;
  }
): Promise<void> {
  // Create package.json
  await writeJson(path.join(dir, 'package.json'), {
    name: 'test-app',
    version: '0.0.1',
    private: true,
    type: 'module',
    scripts: {
      build: 'vite build',
      dev: 'vite',
    },
    dependencies: {
      react: '^19.0.0',
      'react-dom': '^19.0.0',
      springboard: 'workspace:*',
    },
    devDependencies: {
      '@vitejs/plugin-react': '^4.4.0',
      typescript: '^5.9.0',
      vite: '^5.4.0',
    },
  });

  // Create vite.config.ts
  const viteConfigContent = `
import { springboard } from 'springboard/vite-plugin';

export default springboard({
  entry: '${config.entry}',
  platforms: ${JSON.stringify(config.platforms)},
  ${config.partykitName ? `partykitName: '${config.partykitName}',` : ''}
});
`;
  await fs.writeFile(path.join(dir, 'vite.config.ts'), viteConfigContent);

  // Create src directory
  const srcDir = path.join(dir, 'src');
  await fs.mkdir(srcDir, { recursive: true });

  // Create minimal entry file
  const entryContent = `
import React from 'react';

export default function App() {
  return <div>Test App</div>;
}
`;
  await fs.writeFile(path.join(srcDir, 'index.tsx'), entryContent);

  // Create tsconfig.json
  await writeJson(path.join(dir, 'tsconfig.json'), {
    compilerOptions: {
      target: 'ES2020',
      module: 'ESNext',
      lib: ['ES2020', 'DOM', 'DOM.Iterable'],
      jsx: 'react-jsx',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      moduleResolution: 'bundler',
    },
  });

  // Install dependencies
  await execute('pnpm install', { cwd: dir, timeout: 60000 });
}
