/**
 * Springboard Virtual Module Plugin
 *
 * Creates virtual modules for entry points and platform info.
 * These modules are generated dynamically based on configuration.
 */

import type { Plugin } from 'vite';
import type { NormalizedOptions } from '../types.js';
import { VIRTUAL_MODULES, RESOLVED_VIRTUAL_MODULES } from '../types.js';
import {
    generateEntryCode,
    generateModulesCode,
    generatePlatformCode,
} from '../utils/generate-entry.js';
import { createLogger } from './shared.js';

/**
 * Create the springboard virtual module plugin.
 *
 * Provides virtual modules:
 * - virtual:springboard-entry - Auto-generated entry point
 * - virtual:springboard-modules - Access to registered modules
 * - virtual:springboard-platform - Platform information
 *
 * @param options - Normalized plugin options
 * @returns Vite plugin
 */
export function springboardVirtual(options: NormalizedOptions): Plugin {
    const logger = createLogger('virtual', options.debug);

    logger.debug(`Setting up virtual modules for platform: ${options.platform}`);

    return {
        name: 'springboard:virtual',

        /**
         * Resolve virtual module IDs
         */
        resolveId(id: string) {
            if (id === VIRTUAL_MODULES.ENTRY) {
                logger.debug(`Resolving ${VIRTUAL_MODULES.ENTRY}`);
                return RESOLVED_VIRTUAL_MODULES.ENTRY;
            }

            if (id === VIRTUAL_MODULES.MODULES) {
                logger.debug(`Resolving ${VIRTUAL_MODULES.MODULES}`);
                return RESOLVED_VIRTUAL_MODULES.MODULES;
            }

            if (id === VIRTUAL_MODULES.PLATFORM) {
                logger.debug(`Resolving ${VIRTUAL_MODULES.PLATFORM}`);
                return RESOLVED_VIRTUAL_MODULES.PLATFORM;
            }

            return null;
        },

        /**
         * Load virtual module content
         */
        load(id: string) {
            if (id === RESOLVED_VIRTUAL_MODULES.ENTRY) {
                logger.debug('Loading virtual entry module');
                const code = generateEntryCode(options);
                logger.debug(`Generated entry code:\n${code}`);
                return code;
            }

            if (id === RESOLVED_VIRTUAL_MODULES.MODULES) {
                logger.debug('Loading virtual modules module');
                return generateModulesCode(options);
            }

            if (id === RESOLVED_VIRTUAL_MODULES.PLATFORM) {
                logger.debug('Loading virtual platform module');
                return generatePlatformCode(options);
            }

            return null;
        },
    };
}

export default springboardVirtual;
