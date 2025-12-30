import { defineConfig } from 'vite';
import springboard from './springboard-vite-plugin';
// import { springboard } from 'springboard/vite-plugin';

export default defineConfig({
  plugins: [
    springboard({
      entry: './src/tic_tac_toe.tsx',
      // platforms: ['browser', 'node'],
      nodeServerPort: 3001,
    })
  ],
  define: {
    'process.env.DEBUG_LOG_PERFORMANCE': JSON.stringify(process.env.DEBUG_LOG_PERFORMANCE),
  }
});
