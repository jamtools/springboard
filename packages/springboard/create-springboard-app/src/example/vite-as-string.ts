export default `import { defineConfig } from 'vite';
import { springboard } from 'springboard/vite-plugin';
import path from 'node:path';

const platformVariant = process.env.SPRINGBOARD_PLATFORM || '';

let platforms: ('browser' | 'node')[] = ['browser', 'node'];

if (platformVariant === 'node') {
  platforms = ['node'];
} else if (platformVariant === 'browser') {
  platforms = ['browser'];
}

export default defineConfig({
  plugins: [
    springboard({
      entry: './src/index.tsx',
      platforms,
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
  server: {
    port: 3000,
    host: true,
  },
});
`;
