/**
 * Example 1: Minimal Configuration
 *
 * The simplest possible config - framework handles everything.
 * Platforms default to ['browser', 'node'] if omitted.
 */

import { springboard } from 'springboard/vite-plugin';

export default springboard({
  entry: './src/index.tsx',
  // platforms: ['browser', 'node'], // Optional - this is the default!
  documentMeta: {
    title: 'My App',
  },
});
