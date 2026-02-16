export default `import { defineConfig } from 'vite';
import { springboard } from 'springboard/vite-plugin';
import path from 'node:path';

export default defineConfig({
  plugins: [
    springboard({
      entry: './src/index.tsx',
      platforms: ['browser', 'node'],
      documentMeta: {
        title: 'My App',
        description: 'My really cool app',
      },
      nodeServerPort: 1337,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  define: {
    'process.env.DEBUG_LOG_PERFORMANCE': '""',
  },
  build: {
    sourcemap: true,
  },
  server: {
    port: 3000,
    host: true,
  },
});
`;
