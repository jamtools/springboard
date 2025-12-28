/**
 * @deprecated This plugin is part of the legacy esbuild-based CLI.
 * Use the new Vite-based build system with `springboard/vite-plugin` instead.
 *
 * This plugin handles platform-specific conditional compilation using
 * the `// @platform "platform"` directive syntax.
 */

import fs from 'fs';

import type { Plugin } from 'esbuild';

/**
 * @deprecated Use the Vite plugin from `springboard/vite-plugin` instead.
 * Creates an esbuild plugin that processes platform-specific code blocks.
 *
 * Code blocks wrapped in `// @platform "platform"` and `// @platform end`
 * comments will be included or excluded based on the target platform.
 *
 * @param platform - The target platform ('node' | 'browser' | 'fetch' | 'react-native')
 * @returns An esbuild Plugin
 *
 * @example
 * ```typescript
 * // In source code:
 * // @platform "browser"
 * console.log('This only runs in browser');
 * // @platform end
 * ```
 */
export const esbuildPluginPlatformInject = (platform: 'node' | 'browser' | 'fetch' | 'react-native'): Plugin => {
  return {
    name: 'platform-macro',
    setup(build) {
      build.onLoad({ filter: /\.tsx?$/ }, async (args) => {
        let source = await fs.promises.readFile(args.path, 'utf8');

        // Replace platform-specific blocks based on the platform
        const platformRegex = new RegExp(`\/\/ @platform "${platform}"([\\s\\S]*?)\/\/ @platform end`, 'g');
        const otherPlatformRegex = new RegExp(`\/\/ @platform "(node|browser|react-native|fetch)"([\\s\\S]*?)\/\/ @platform end`, 'g');

        // Include only the code relevant to the current platform
        source = source.replace(platformRegex, '$1');

        // Remove the code for the other platforms
        source = source.replace(otherPlatformRegex, '');

        return {
          contents: source,
          loader: args.path.split('.').pop() as 'js',
        };
      });
    },
  };
};
