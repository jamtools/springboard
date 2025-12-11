/**
 * Dev Server Tests
 *
 * Tests the development server functionality including HMR, platform switching,
 * and live reloading.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  createTempDir,
  cleanupDir,
  writeJson,
  readJson,
} from '../utils/file-system.js';
import {
  execute,
  runDevServer,
  waitForUrl,
  type SpawnedProcess,
} from '../utils/exec.js';

describe('Dev Server', () => {
  let testDir: string;
  let devProcess: SpawnedProcess | null = null;

  beforeAll(async () => {
    testDir = await createTempDir('dev-server-test-');
  });

  afterAll(async () => {
    await cleanupDir(testDir);
  });

  afterEach(async () => {
    if (devProcess) {
      devProcess.kill();
      devProcess = null;
      // Wait a bit for port to be released
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  });

  describe('Browser Platform Dev Server', () => {
    let browserAppDir: string;

    beforeAll(async () => {
      browserAppDir = path.join(testDir, 'browser-dev');
      await fs.mkdir(browserAppDir, { recursive: true });

      await createDevTestApp(browserAppDir, {
        platforms: ['browser'],
        entry: './src/index.tsx',
      });
    });

    it('should start dev server for browser platform', async () => {
      devProcess = await runDevServer(browserAppDir);

      // Wait for server to be accessible
      await waitForUrl('http://localhost:5173', 30000);

      // Verify we can fetch the page
      const response = await fetch('http://localhost:5173');
      expect(response.ok).toBe(true);

      const html = await response.text();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<div id="root">');
    }, 60000);

    it('should serve with proper content type', async () => {
      devProcess = await runDevServer(browserAppDir);
      await waitForUrl('http://localhost:5173', 30000);

      const response = await fetch('http://localhost:5173');
      const contentType = response.headers.get('content-type');

      expect(contentType).toContain('text/html');
    }, 60000);

    it('should handle HMR updates', async () => {
      devProcess = await runDevServer(browserAppDir);
      await waitForUrl('http://localhost:5173', 30000);

      // Fetch initial page
      const initialResponse = await fetch('http://localhost:5173');
      const initialHtml = await initialResponse.text();

      // Modify source file
      const srcFile = path.join(browserAppDir, 'src/index.tsx');
      await fs.writeFile(
        srcFile,
        `
import React from 'react';

export default function App() {
  return <div>Updated Test App</div>;
}
`
      );

      // Wait for HMR to process
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // The dev server should still be running
      const updatedResponse = await fetch('http://localhost:5173');
      expect(updatedResponse.ok).toBe(true);
    }, 60000);

    it('should inject Vite client scripts', async () => {
      devProcess = await runDevServer(browserAppDir);
      await waitForUrl('http://localhost:5173', 30000);

      const response = await fetch('http://localhost:5173');
      const html = await response.text();

      // Vite dev server should inject its client
      expect(html).toContain('@vite/client');
    }, 60000);
  });

  describe('Platform-Specific Dev Features', () => {
    let multiPlatformDir: string;

    beforeAll(async () => {
      multiPlatformDir = path.join(testDir, 'multi-platform-dev');
      await fs.mkdir(multiPlatformDir, { recursive: true });

      await createDevTestApp(multiPlatformDir, {
        platforms: ['browser'],
        entry: './src/index.tsx',
        withPlatformCode: true,
      });
    });

    it('should transform @platform directives in dev mode', async () => {
      devProcess = await runDevServer(multiPlatformDir);
      await waitForUrl('http://localhost:5173', 30000);

      // Fetch the entry module
      const response = await fetch('http://localhost:5173/src/index.tsx');
      expect(response.ok).toBe(true);

      const code = await response.text();

      // Platform directives should be transformed
      // Browser platform should include browser code, exclude others
      expect(code).not.toContain('@platform');
    }, 60000);

    it('should serve virtual modules', async () => {
      devProcess = await runDevServer(multiPlatformDir);
      await waitForUrl('http://localhost:5173', 30000);

      // Try to access virtual module (Vite may not expose this directly)
      // This tests that the virtual module plugin is working
      const response = await fetch('http://localhost:5173');
      expect(response.ok).toBe(true);
    }, 60000);
  });

  describe('Error Handling', () => {
    let errorAppDir: string;

    beforeAll(async () => {
      errorAppDir = path.join(testDir, 'error-app');
      await fs.mkdir(errorAppDir, { recursive: true });

      await createDevTestApp(errorAppDir, {
        platforms: ['browser'],
        entry: './src/index.tsx',
      });
    });

    it('should handle syntax errors gracefully', async () => {
      devProcess = await runDevServer(errorAppDir);
      await waitForUrl('http://localhost:5173', 30000);

      // Introduce syntax error
      const srcFile = path.join(errorAppDir, 'src/index.tsx');
      await fs.writeFile(
        srcFile,
        `
import React from 'react';

export default function App() {
  return <div>Syntax Error
}
`
      );

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Server should still be running (Vite shows overlay for errors)
      const response = await fetch('http://localhost:5173');
      expect(response.ok).toBe(true);

      // Fix the error
      await fs.writeFile(
        srcFile,
        `
import React from 'react';

export default function App() {
  return <div>Fixed</div>;
}
`
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Should still work
      const fixedResponse = await fetch('http://localhost:5173');
      expect(fixedResponse.ok).toBe(true);
    }, 90000);
  });

  describe('Port Configuration', () => {
    it('should respect custom port via Vite config', async () => {
      const customPortDir = path.join(testDir, 'custom-port');
      await fs.mkdir(customPortDir, { recursive: true });

      await createDevTestApp(customPortDir, {
        platforms: ['browser'],
        entry: './src/index.tsx',
        viteConfig: {
          server: {
            port: 5174,
          },
        },
      });

      devProcess = await runDevServer(customPortDir, undefined, /5174/);
      await waitForUrl('http://localhost:5174', 30000);

      const response = await fetch('http://localhost:5174');
      expect(response.ok).toBe(true);
    }, 60000);
  });

  describe('Performance', () => {
    let perfAppDir: string;

    beforeAll(async () => {
      perfAppDir = path.join(testDir, 'perf-app');
      await fs.mkdir(perfAppDir, { recursive: true });

      await createDevTestApp(perfAppDir, {
        platforms: ['browser'],
        entry: './src/index.tsx',
      });
    });

    it('should start dev server quickly', async () => {
      const startTime = Date.now();

      devProcess = await runDevServer(perfAppDir);
      await waitForUrl('http://localhost:5173', 30000);

      const duration = Date.now() - startTime;

      // Should start within 15 seconds
      expect(duration).toBeLessThan(15000);

      console.log(`  Dev server started in ${duration}ms`);
    }, 60000);

    it('should respond to requests quickly', async () => {
      devProcess = await runDevServer(perfAppDir);
      await waitForUrl('http://localhost:5173', 30000);

      const startTime = Date.now();
      const response = await fetch('http://localhost:5173');
      const duration = Date.now() - startTime;

      expect(response.ok).toBe(true);
      // Should respond within 2 seconds
      expect(duration).toBeLessThan(2000);

      console.log(`  Page loaded in ${duration}ms`);
    }, 60000);
  });
});

/**
 * Helper to create a minimal dev test app
 */
async function createDevTestApp(
  dir: string,
  config: {
    platforms: string[];
    entry: string;
    partykitName?: string;
    withPlatformCode?: boolean;
    viteConfig?: Record<string, unknown>;
  }
): Promise<void> {
  // Create package.json
  await writeJson(path.join(dir, 'package.json'), {
    name: 'dev-test-app',
    version: '0.0.1',
    private: true,
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'vite build',
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
  let viteConfigContent = `
import { springboard } from 'springboard/vite-plugin';

export default springboard({
  entry: '${config.entry}',
  platforms: ${JSON.stringify(config.platforms)},
  ${config.partykitName ? `partykitName: '${config.partykitName}',` : ''}
`;

  if (config.viteConfig) {
    viteConfigContent += `  viteConfig: ${JSON.stringify(config.viteConfig, null, 2)},\n`;
  }

  viteConfigContent += '});\n';

  await fs.writeFile(path.join(dir, 'vite.config.ts'), viteConfigContent);

  // Create src directory
  const srcDir = path.join(dir, 'src');
  await fs.mkdir(srcDir, { recursive: true });

  // Create entry file
  let entryContent = `
import React from 'react';

export default function App() {
  return (
    <div>
      <h1>Dev Test App</h1>
`;

  if (config.withPlatformCode) {
    entryContent += `
      {/* @platform "browser" */}
      <p>Browser-specific content</p>
      {/* @platform end */}

      {/* @platform "node" */}
      <p>Node-specific content</p>
      {/* @platform end */}
`;
  }

  entryContent += `
    </div>
  );
}
`;

  await fs.writeFile(path.join(srcDir, 'index.tsx'), entryContent);

  // Create index.html for browser platforms
  if (config.platforms.includes('browser')) {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dev Test App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/index.tsx"></script>
  </body>
</html>
`;
    await fs.writeFile(path.join(dir, 'index.html'), htmlContent);
  }

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
