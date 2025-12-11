/**
 * Example 2: Custom Vite Configuration
 *
 * Shows how to customize Vite config to your heart's content.
 * You can pass any standard Vite options via the viteConfig property.
 */

import { springboard } from 'springboard/vite-plugin';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default springboard({
  entry: './src/index.tsx',
  platforms: ['browser', 'node'],

  // Option A: Object - same config for all platforms
  viteConfig: {
    // Standard Vite config - configure to your heart's content!
    server: {
      port: 3000,
      open: true,
    },

    build: {
      sourcemap: true,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
        },
      },
    },

    plugins: [
      // Add your own Vite plugins
      react({
        babel: {
          plugins: ['babel-plugin-styled-components'],
        },
      }),
      visualizer(),
    ],

    resolve: {
      alias: {
        '@components': '/src/components',
        '@utils': '/src/utils',
      },
    },

    css: {
      modules: {
        localsConvention: 'camelCase',
      },
      preprocessorOptions: {
        scss: {
          additionalData: `@import "@/styles/variables.scss";`,
        },
      },
    },

    define: {
      __APP_VERSION__: JSON.stringify('1.0.0'),
      __API_URL__: JSON.stringify(process.env.API_URL),
    },
  },
});
