/**
 * Smoke Test
 *
 * A quick sanity check to verify the test environment is working.
 * Run this first to ensure vitest is configured correctly.
 *
 * Usage:
 *   pnpm test:vite tests/smoke.test.ts
 */

import { describe, it, expect } from 'vitest';

describe('Smoke Test', () => {
  it('should run vitest successfully', () => {
    expect(true).toBe(true);
  });

  it('should have access to Node.js APIs', () => {
    expect(process).toBeDefined();
    expect(process.version).toBeTruthy();
  });

  it('should support async/await', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });

  it('should support ES modules', async () => {
    const { readFile } = await import('fs/promises');
    expect(typeof readFile).toBe('function');
  });

  it('should have correct test environment', () => {
    expect(process.env.NODE_ENV).toBeDefined();
  });
});

describe('Test Utilities', () => {
  it('should import file-system utils', async () => {
    const { fileExists } = await import('./utils/file-system.js');
    expect(typeof fileExists).toBe('function');
  });

  it('should import exec utils', async () => {
    const { execute } = await import('./utils/exec.js');
    expect(typeof execute).toBe('function');
  });

  it('should import verdaccio utils', async () => {
    const { startVerdaccio } = await import('./utils/verdaccio.js');
    expect(typeof startVerdaccio).toBe('function');
  });
});

describe('Vite Plugin Access', () => {
  it('should access springboard vite plugin', async () => {
    const { springboard } = await import('../packages/springboard/vite-plugin/src/index.js');
    expect(typeof springboard).toBe('function');
  });

  it('should create plugin configuration', async () => {
    const { springboard } = await import('../packages/springboard/vite-plugin/src/index.js');

    const plugins = springboard({
      entry: './src/index.tsx',
      platforms: ['browser'],
    });

    expect(Array.isArray(plugins)).toBe(true);
    expect(plugins.length).toBeGreaterThan(0);
    expect(plugins.every(p => typeof p.name === 'string')).toBe(true);
  });
});
