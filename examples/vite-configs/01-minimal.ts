/**
 * Example 1: Minimal Configuration
 *
 * The simplest possible config - framework handles everything.
 */

import { springboard } from 'springboard/vite-plugin';

export default springboard({
  entry: './src/index.tsx',
  platforms: ['browser'],
  documentMeta: {
    title: 'My App',
  },
});
