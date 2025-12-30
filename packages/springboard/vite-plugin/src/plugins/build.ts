/**
 * Springboard Build Plugin
 *
 * This plugin is not used in the simplified monolithic plugin architecture.
 * Build configuration is handled directly in the main plugin's config() hook.
 */

import type { Plugin } from 'vite';
import type { NormalizedOptions } from '../types.js';

export function springboardBuild(options: NormalizedOptions): Plugin | null {
    // Return null - build configuration is handled in the main plugin
    return null;
}

export default springboardBuild;
