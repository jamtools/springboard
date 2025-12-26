/**
 * Vite Plugin Integration Tests
 *
 * Unit tests for individual plugin components and transformations.
 */

import { describe, it, expect } from 'vitest';
import {
  generateEntryCode,
  generateModulesCode,
  generatePlatformCode,
} from '../../packages/springboard/vite-plugin/src/utils/generate-entry.js';
import {
  getPlatformConfig,
  isBrowserPlatform,
  isServerPlatform,
} from '../../packages/springboard/vite-plugin/src/config/platform-configs.js';
import {
  detectPlatform,
  setPlatformEnv,
  clearPlatformEnv,
} from '../../packages/springboard/vite-plugin/src/config/detect-platform.js';
import type { Platform } from '../../packages/springboard/vite-plugin/src/types.js';

describe('Virtual Entry Generation', () => {
  describe('generateEntryCode()', () => {
    it('should generate valid entry code', () => {
      const code = generateEntryCode('/path/to/entry.tsx', 'browser');

      expect(code).toContain('import');
      expect(code).toContain('/path/to/entry.tsx');
      expect(code).toBeTruthy();
    });

    it('should handle different platforms', () => {
      const platforms: Platform[] = ['browser', 'node', 'partykit'];

      platforms.forEach((platform) => {
        const code = generateEntryCode('/path/to/entry.tsx', platform);
        expect(code).toBeTruthy();
        expect(code).toContain('import');
      });
    });
  });

  describe('generateModulesCode()', () => {
    it('should generate modules export code', () => {
      const code = generateModulesCode();

      expect(code).toContain('export');
      expect(code).toBeTruthy();
    });
  });

  describe('generatePlatformCode()', () => {
    it('should generate platform indicator code', () => {
      const code = generatePlatformCode('browser');

      expect(code).toContain('browser');
      expect(code).toContain('export');
    });

    it('should generate code for all platforms', () => {
      const platforms: Platform[] = ['browser', 'node', 'partykit', 'tauri', 'react-native'];

      platforms.forEach((platform) => {
        const code = generatePlatformCode(platform);
        expect(code).toBeTruthy();
        expect(code).toContain('export');
      });
    });
  });
});

describe('Platform Configuration', () => {
  describe('getPlatformConfig()', () => {
    it('should return config for browser platform', () => {
      const config = getPlatformConfig('browser');

      expect(config).toBeDefined();
      expect(config.macro).toBe('browser');
      expect(config.ssr).toBe(false);
    });

    it('should return config for node platform', () => {
      const config = getPlatformConfig('node');

      expect(config).toBeDefined();
      expect(config.macro).toBe('node');
      expect(config.ssr).toBe(true);
    });

    it('should return config for partykit platform', () => {
      const config = getPlatformConfig('partykit');

      expect(config).toBeDefined();
      expect(config.macro).toBe('fetch');
      expect(config.ssr).toBe(true);
    });

    it('should return config for tauri platform', () => {
      const config = getPlatformConfig('tauri');

      expect(config).toBeDefined();
      expect(config.macro).toBe('browser');
      expect(config.ssr).toBe(false);
    });

    it('should return config for react-native platform', () => {
      const config = getPlatformConfig('react-native');

      expect(config).toBeDefined();
      expect(config.macro).toBe('react-native');
      expect(config.ssr).toBe(false);
    });
  });

  describe('isBrowserPlatform()', () => {
    it('should identify browser platforms', () => {
      expect(isBrowserPlatform('browser')).toBe(true);
      expect(isBrowserPlatform('tauri')).toBe(true);
    });

    it('should identify non-browser platforms', () => {
      expect(isBrowserPlatform('node')).toBe(false);
      expect(isBrowserPlatform('partykit')).toBe(false);
      expect(isBrowserPlatform('react-native')).toBe(false);
    });
  });

  describe('isServerPlatform()', () => {
    it('should identify server platforms', () => {
      expect(isServerPlatform('node')).toBe(true);
      expect(isServerPlatform('partykit')).toBe(true);
    });

    it('should identify non-server platforms', () => {
      expect(isServerPlatform('browser')).toBe(false);
      expect(isServerPlatform('tauri')).toBe(false);
      expect(isServerPlatform('react-native')).toBe(false);
    });
  });
});

describe('Platform Detection', () => {
  describe('setPlatformEnv() and clearPlatformEnv()', () => {
    it('should set and clear platform environment variable', () => {
      setPlatformEnv('browser');
      expect(process.env.SPRINGBOARD_PLATFORM).toBe('browser');

      clearPlatformEnv();
      expect(process.env.SPRINGBOARD_PLATFORM).toBeUndefined();
    });

    it('should set different platforms', () => {
      const platforms: Platform[] = ['browser', 'node', 'partykit'];

      platforms.forEach((platform) => {
        setPlatformEnv(platform);
        expect(process.env.SPRINGBOARD_PLATFORM).toBe(platform);
      });

      clearPlatformEnv();
    });
  });

  describe('detectPlatform()', () => {
    it('should detect platform from environment', () => {
      setPlatformEnv('node');
      const detected = detectPlatform();
      expect(detected).toBe('node');

      clearPlatformEnv();
    });

    it('should return undefined when no platform is set', () => {
      clearPlatformEnv();
      const detected = detectPlatform();
      expect(detected).toBeUndefined();
    });
  });
});

describe('Platform Macro Mapping', () => {
  it('should map platforms to correct macros', () => {
    const mappings: Record<Platform, string> = {
      browser: 'browser',
      node: 'node',
      partykit: 'fetch',
      tauri: 'browser',
      'react-native': 'react-native',
    };

    Object.entries(mappings).forEach(([platform, expectedMacro]) => {
      const config = getPlatformConfig(platform as Platform);
      expect(config.macro).toBe(expectedMacro);
    });
  });
});

describe('Virtual Module IDs', () => {
  it('should have consistent virtual module prefixes', async () => {
    const { VIRTUAL_MODULES, RESOLVED_VIRTUAL_MODULES } =
      await import('../../packages/springboard/vite-plugin/src/types.js');

    // Virtual modules should have consistent IDs
    expect(VIRTUAL_MODULES.ENTRY).toBe('virtual:springboard-entry');
    expect(VIRTUAL_MODULES.MODULES).toBe('virtual:springboard-modules');
    expect(VIRTUAL_MODULES.PLATFORM).toBe('virtual:springboard-platform');

    // Resolved modules should have \0 prefix
    expect(RESOLVED_VIRTUAL_MODULES.ENTRY).toBe('\0virtual:springboard-entry');
    expect(RESOLVED_VIRTUAL_MODULES.MODULES).toBe('\0virtual:springboard-modules');
    expect(RESOLVED_VIRTUAL_MODULES.PLATFORM).toBe('\0virtual:springboard-platform');
  });
});

describe('Code Generation Validity', () => {
  it('should generate syntactically valid JavaScript', () => {
    const entryCode = generateEntryCode('./src/index.tsx', 'browser');
    const modulesCode = generateModulesCode();
    const platformCode = generatePlatformCode('browser');

    // Basic syntax check - should not throw
    expect(() => new Function(entryCode)).not.toThrow();
    expect(() => new Function(modulesCode)).not.toThrow();
    expect(() => new Function(platformCode)).not.toThrow();
  });

  it('should generate code with proper imports', () => {
    const code = generateEntryCode('./src/index.tsx', 'browser');

    // Should have import statement
    expect(code).toMatch(/import.*from/);
  });

  it('should generate code with proper exports', () => {
    const modulesCode = generateModulesCode();
    const platformCode = generatePlatformCode('browser');

    // Should have export statement
    expect(modulesCode).toContain('export');
    expect(platformCode).toContain('export');
  });
});
