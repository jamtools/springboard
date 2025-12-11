import { defineConfig, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { resolve } from 'path';

// Multi-platform Vite configuration for testing Springboard
// Supports: browser, server (Node.js), and partykit builds

export default defineConfig(({ mode }) => {
  const baseConfig: UserConfig = {
    plugins: [
      react(),
      tsconfigPaths(),
    ],
    resolve: {
      // Test that Vite properly resolves export conditions
      conditions: ['import', 'module', 'browser', 'default'],
    },
  };

  // Browser platform configuration (default)
  if (mode === 'browser' || mode === 'development') {
    return {
      ...baseConfig,
      root: '.',
      build: {
        outDir: 'dist/browser',
        rollupOptions: {
          input: {
            main: resolve(__dirname, 'index.html'),
          },
        },
        // Test that Vite can tree-shake platform-specific code
        minify: 'terser',
        sourcemap: true,
      },
      server: {
        port: 3000,
        // Test HMR functionality
        hmr: {
          overlay: true,
        },
      },
      // Define environment for browser
      define: {
        'process.env.PLATFORM': JSON.stringify('browser'),
        'process.env.NODE_ENV': JSON.stringify(mode === 'development' ? 'development' : 'production'),
      },
    };
  }

  // Node.js server platform configuration
  if (mode === 'server') {
    return {
      ...baseConfig,
      build: {
        outDir: 'dist/server',
        ssr: true,
        target: 'node20',
        rollupOptions: {
          input: {
            server: resolve(__dirname, 'src/server/index.ts'),
          },
          output: {
            format: 'esm',
            entryFileNames: '[name].mjs',
          },
          // Keep node_modules external for server build
          external: [
            /^node:/,
            'fs',
            'path',
            'http',
            'https',
            'crypto',
            'stream',
            'util',
            'os',
            'url',
            'events',
            'buffer',
            'querystring',
            'child_process',
            'worker_threads',
          ],
        },
        sourcemap: true,
        minify: false,
      },
      resolve: {
        ...baseConfig.resolve,
        // Use Node.js export conditions for server build
        conditions: ['node', 'import', 'module', 'default'],
      },
      define: {
        'process.env.PLATFORM': JSON.stringify('node'),
      },
      // Disable plugins not needed for server
      plugins: [tsconfigPaths()],
    };
  }

  // PartyKit/Workerd platform configuration
  if (mode === 'partykit') {
    return {
      ...baseConfig,
      build: {
        outDir: 'dist/partykit',
        ssr: true,
        target: 'esnext',
        rollupOptions: {
          input: {
            server: resolve(__dirname, 'src/partykit/server.ts'),
          },
          output: {
            format: 'esm',
            entryFileNames: '[name].mjs',
          },
        },
        sourcemap: true,
        minify: false,
      },
      resolve: {
        ...baseConfig.resolve,
        // Use workerd export conditions for PartyKit
        conditions: ['workerd', 'worker', 'import', 'module', 'default'],
      },
      define: {
        'process.env.PLATFORM': JSON.stringify('partykit'),
      },
      plugins: [tsconfigPaths()],
    };
  }

  // Default to browser config
  return baseConfig;
});
