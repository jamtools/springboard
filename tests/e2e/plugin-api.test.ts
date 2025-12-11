/**
 * Springboard Vite Plugin API Tests
 *
 * Tests the plugin API directly to ensure proper behavior, validation, and configuration.
 */

import { describe, it, expect } from 'vitest';
import {
  springboard,
  springboardPlugins,
  defineSpringboardConfig,
  normalizeOptions,
  createOptionsForPlatform,
  getPlatformConfig,
  isBrowserPlatform,
  isServerPlatform,
  type SpringboardOptions,
  type Platform,
} from '../../packages/springboard/vite-plugin/src/index.js';

describe('Springboard Vite Plugin API', () => {
  describe('springboard() function', () => {
    it('should export springboard function', () => {
      expect(springboard).toBeTypeOf('function');
    });

    it('should return Vite config object with plugins', () => {
      const config = springboard({
        entry: './src/index.tsx',
        platforms: ['browser'],
      });

      expect(config).toBeTypeOf('object');
      expect(config).toHaveProperty('plugins');
      expect(Array.isArray(config.plugins)).toBe(true);
      expect(config.plugins.length).toBeGreaterThan(0);

      // Each plugin should have a name
      config.plugins.forEach((plugin) => {
        expect(plugin).toHaveProperty('name');
        expect(typeof plugin.name).toBe('string');
      });
    });

    it('should accept minimal configuration', () => {
      const config = springboard({
        entry: './src/index.tsx',
      });

      expect(config.plugins.length).toBeGreaterThan(0);
    });

    it('should accept multi-platform configuration', () => {
      const config = springboard({
        entry: './src/index.tsx',
        platforms: ['browser', 'node', 'partykit'],
      });

      expect(config.plugins.length).toBeGreaterThan(0);
    });

    it('should accept document metadata', () => {
      const config = springboard({
        entry: './src/index.tsx',
        platforms: ['browser'],
        documentMeta: {
          title: 'Test App',
          description: 'A test application',
        },
      });

      expect(config.plugins.length).toBeGreaterThan(0);
    });

    it('should accept custom Vite config as object', () => {
      const config = springboard({
        entry: './src/index.tsx',
        platforms: ['browser', 'node'],
        viteConfig: {
          browser: {
            build: { outDir: 'dist/web' },
          },
          node: {
            build: { outDir: 'dist/server' },
          },
        },
      });

      expect(config.plugins.length).toBeGreaterThan(0);
    });

    it('should accept custom Vite config as function', () => {
      const config = springboard({
        entry: './src/index.tsx',
        platforms: ['browser'],
        viteConfig: (platform, baseConfig) => {
          return {
            ...baseConfig,
            build: {
              outDir: `dist/${platform}`,
            },
          };
        },
      });

      expect(config.plugins.length).toBeGreaterThan(0);
    });

    it('should validate required entry option', () => {
      expect(() => {
        springboard({
          // @ts-expect-error - Testing missing entry
          platforms: ['browser'],
        });
      }).toThrow();
    });

    it('should accept per-platform entry configuration', () => {
      const config = springboard({
        entry: {
          browser: './src/index.browser.tsx',
          node: './src/index.node.tsx',
        },
        platforms: ['browser', 'node'],
      });

      expect(config.plugins.length).toBeGreaterThan(0);
    });

    it('should accept debug option', () => {
      const config = springboard({
        entry: './src/index.tsx',
        platforms: ['browser'],
        debug: true,
      });

      expect(config.plugins.length).toBeGreaterThan(0);
    });

    it('should accept outDir option', () => {
      const config = springboard({
        entry: './src/index.tsx',
        platforms: ['browser'],
        outDir: 'build',
      });

      expect(config.plugins.length).toBeGreaterThan(0);
    });

    it('should accept partykitName for PartyKit platform', () => {
      const config = springboard({
        entry: './src/index.tsx',
        platforms: ['partykit'],
        partykitName: 'my-party-app',
      });

      expect(config.plugins.length).toBeGreaterThan(0);
    });
  });

  describe('springboardPlugins() function', () => {
    it('should export springboardPlugins function', () => {
      expect(springboardPlugins).toBeTypeOf('function');
    });

    it('should create plugins for specific platform', () => {
      const plugins = springboardPlugins(
        {
          entry: './src/index.tsx',
          platforms: ['browser', 'node'],
        },
        'browser'
      );

      expect(Array.isArray(plugins)).toBe(true);
      expect(plugins.length).toBeGreaterThan(0);
    });

    it('should create plugins without specific platform', () => {
      const plugins = springboardPlugins({
        entry: './src/index.tsx',
        platforms: ['browser'],
      });

      expect(Array.isArray(plugins)).toBe(true);
      expect(plugins.length).toBeGreaterThan(0);
    });
  });

  describe('defineSpringboardConfig() function', () => {
    it('should export defineSpringboardConfig function', () => {
      expect(defineSpringboardConfig).toBeTypeOf('function');
    });

    it('should return UserConfig with plugins', () => {
      const config = defineSpringboardConfig({
        entry: './src/index.tsx',
        platforms: ['browser'],
      });

      expect(config).toHaveProperty('plugins');
      expect(Array.isArray(config.plugins)).toBe(true);
    });
  });

  describe('normalizeOptions() function', () => {
    it('should export normalizeOptions function', () => {
      expect(normalizeOptions).toBeTypeOf('function');
    });

    it('should normalize basic options', () => {
      const options: SpringboardOptions = {
        entry: './src/index.tsx',
      };

      const normalized = normalizeOptions(options);

      expect(normalized).toHaveProperty('entry');
      expect(normalized).toHaveProperty('platforms');
      expect(normalized).toHaveProperty('platform');
      expect(normalized).toHaveProperty('platformMacro');
      expect(normalized).toHaveProperty('debug');
      expect(normalized).toHaveProperty('outDir');
      expect(normalized).toHaveProperty('root');
    });

    it('should default platforms to ["browser"]', () => {
      const normalized = normalizeOptions({
        entry: './src/index.tsx',
      });

      expect(normalized.platforms).toEqual(['browser']);
      expect(normalized.platform).toBe('browser');
    });

    it('should resolve entry for current platform', () => {
      const normalized = normalizeOptions({
        entry: {
          browser: './src/browser.tsx',
          node: './src/node.tsx',
        },
        platforms: ['browser', 'node'],
      });

      expect(normalized.entry).toMatch(/\.(tsx|ts)$/);
    });

    it('should map platform to platformMacro', () => {
      const browserNorm = normalizeOptions({ entry: './src/index.tsx', platforms: ['browser'] });
      expect(browserNorm.platformMacro).toBe('browser');

      const nodeNorm = normalizeOptions({ entry: './src/index.tsx', platforms: ['node'] });
      expect(nodeNorm.platformMacro).toBe('node');

      const partykitNorm = normalizeOptions({ entry: './src/index.tsx', platforms: ['partykit'] });
      expect(partykitNorm.platformMacro).toBe('fetch');
    });
  });

  describe('createOptionsForPlatform() function', () => {
    it('should export createOptionsForPlatform function', () => {
      expect(createOptionsForPlatform).toBeTypeOf('function');
    });

    it('should create options for specific platform', () => {
      const options: SpringboardOptions = {
        entry: './src/index.tsx', // Use single entry for now
        platforms: ['browser', 'node'],
      };

      // Need to normalize first before passing to createOptionsForPlatform
      const normalized = normalizeOptions(options);

      const browserOpts = createOptionsForPlatform(normalized, 'browser');
      expect(browserOpts.platform).toBe('browser');
      expect(browserOpts.entry).toContain('index');

      const nodeOpts = createOptionsForPlatform(normalized, 'node');
      expect(nodeOpts.platform).toBe('node');
      expect(nodeOpts.entry).toContain('index');
    });
  });

  describe('Platform configuration utilities', () => {
    it('should export getPlatformConfig', () => {
      expect(getPlatformConfig).toBeTypeOf('function');
    });

    it('should get config for each platform', () => {
      const platforms: Platform[] = ['browser', 'node', 'partykit', 'tauri', 'react-native'];

      platforms.forEach((platform) => {
        const config = getPlatformConfig(platform);
        expect(config).toBeDefined();
        expect(config).toHaveProperty('build');
        // Not all configs have macro/ssr, just verify build exists
      });
    });

    it('should identify browser platforms', () => {
      expect(isBrowserPlatform('browser')).toBe(true);
      expect(isBrowserPlatform('tauri')).toBe(true);
      expect(isBrowserPlatform('node')).toBe(false);
      expect(isBrowserPlatform('partykit')).toBe(false);
    });

    it('should identify server platforms', () => {
      expect(isServerPlatform('node')).toBe(true);
      expect(isServerPlatform('partykit')).toBe(true);
      expect(isServerPlatform('browser')).toBe(false);
      expect(isServerPlatform('tauri')).toBe(false);
    });
  });

  describe('Plugin names and structure', () => {
    it('should have expected plugin names', () => {
      const config = springboard({
        entry: './src/index.tsx',
        platforms: ['browser'],
      });

      const pluginNames = config.plugins.map((p) => p.name);

      // Should include core plugins
      expect(pluginNames).toContain('springboard:init');
      expect(pluginNames).toContain('springboard:virtual');
      expect(pluginNames).toContain('springboard:platform-inject');
    });

    it('should include build plugin in production', () => {
      const config = springboard({
        entry: './src/index.tsx',
        platforms: ['browser', 'node'],
      });

      const pluginNames = config.plugins.map((p) => p.name);
      expect(pluginNames).toContain('springboard:build');
    });

    it('should include HTML plugin for browser platforms', () => {
      const config = springboard({
        entry: './src/index.tsx',
        platforms: ['browser'],
      });

      const pluginNames = config.plugins.map((p) => p.name);
      expect(pluginNames).toContain('springboard:html');
    });
  });

  describe('Type exports', () => {
    it('should export TypeScript types', () => {
      // This is a compile-time test - if this compiles, types are exported correctly
      const options: SpringboardOptions = {
        entry: './src/index.tsx',
        platforms: ['browser'] as Platform[],
        documentMeta: {
          title: 'Test',
        },
      };

      expect(options).toBeDefined();
    });
  });
});
