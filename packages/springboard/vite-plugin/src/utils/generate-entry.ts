/**
 * Generate Entry Utility
 *
 * Generates virtual entry point code for different platforms.
 */

import type { NormalizedOptions, Platform } from '../types.js';

/**
 * Generate the virtual entry point code for the current platform.
 *
 * The entry point chains:
 * 1. Platform-specific core initialization
 * 2. User's application entrypoint
 *
 * @param options - Normalized options
 * @returns Generated JavaScript code
 */
export function generateEntryCode(options: NormalizedOptions): string {
    const { entry, platform } = options;

    // Resolve entry path (ensure it starts with ./ or /)
    const resolvedEntry = entry.startsWith('.') || entry.startsWith('/')
        ? entry
        : `./${entry}`;

    switch (platform) {
        case 'browser':
            return generateBrowserEntry(resolvedEntry);
        case 'node':
            return generateNodeEntry(resolvedEntry);
        case 'partykit':
            return generatePartykitEntry(resolvedEntry);
        case 'tauri':
            return generateTauriEntry(resolvedEntry);
        case 'react-native':
            return generateReactNativeEntry(resolvedEntry);
        default:
            return generateBrowserEntry(resolvedEntry);
    }
}

/**
 * Generate browser entry point
 */
function generateBrowserEntry(entry: string): string {
    return `
// Springboard Browser Entry (auto-generated)
import { initBrowser } from 'springboard/platforms/browser';

// Import user application
import '${entry}';

// Initialize browser platform
const app = initBrowser();

export default app;
`.trim();
}

/**
 * Generate Node.js entry point
 */
function generateNodeEntry(entry: string): string {
    return `
// Springboard Node Entry (auto-generated)
import { initNode } from 'springboard/platforms/node';

// Import user application
import '${entry}';

// Initialize Node platform
const app = await initNode();

export default app;
`.trim();
}

/**
 * Generate PartyKit entry point
 */
function generatePartykitEntry(entry: string): string {
    return `
// Springboard PartyKit Entry (auto-generated)
import { initPartykit } from 'springboard/platforms/partykit';

// Import user application
import '${entry}';

// Initialize PartyKit platform and export server
const server = initPartykit();

export default server;
`.trim();
}

/**
 * Generate Tauri entry point (browser-based with Tauri APIs)
 */
function generateTauriEntry(entry: string): string {
    return `
// Springboard Tauri Entry (auto-generated)
import { initTauri } from 'springboard/platforms/tauri';

// Import user application
import '${entry}';

// Initialize Tauri platform
const app = initTauri();

export default app;
`.trim();
}

/**
 * Generate React Native entry point
 */
function generateReactNativeEntry(entry: string): string {
    return `
// Springboard React Native Entry (auto-generated)
import { initReactNative } from 'springboard/platforms/react-native';

// Import user application
import '${entry}';

// Initialize React Native platform
const app = initReactNative();

export default app;
`.trim();
}

/**
 * Generate modules virtual module code.
 * This provides access to registered Springboard modules.
 *
 * @param options - Normalized options
 * @returns Generated JavaScript code
 */
export function generateModulesCode(options: NormalizedOptions): string {
    return `
// Springboard Modules (auto-generated)
// This module provides access to registered Springboard modules

import { getRegisteredModules } from 'springboard/core';

export const modules = getRegisteredModules();
export default modules;
`.trim();
}

/**
 * Generate platform info virtual module code.
 *
 * @param options - Normalized options
 * @returns Generated JavaScript code
 */
export function generatePlatformCode(options: NormalizedOptions): string {
    const { platform, platformMacro, debug } = options;

    return `
// Springboard Platform Info (auto-generated)

export const platform = '${platform}';
export const platformMacro = '${platformMacro}';
export const isDev = ${process.env.NODE_ENV !== 'production'};
export const isDebug = ${debug};

export const isBrowser = ${platform === 'browser' || platform === 'tauri'};
export const isNode = ${platform === 'node'};
export const isPartykit = ${platform === 'partykit'};
export const isTauri = ${platform === 'tauri'};
export const isReactNative = ${platform === 'react-native'};
export const isServer = ${platform === 'node' || platform === 'partykit'};
export const isClient = ${platform === 'browser' || platform === 'tauri' || platform === 'react-native'};

export default {
    platform,
    platformMacro,
    isDev,
    isDebug,
    isBrowser,
    isNode,
    isPartykit,
    isTauri,
    isReactNative,
    isServer,
    isClient,
};
`.trim();
}

/**
 * Get the core files needed for a platform.
 * This is used when we need to chain multiple core files.
 *
 * @param platform - Target platform
 * @returns Array of core file paths
 */
export function getCoreFiles(platform: Platform): string[] {
    switch (platform) {
        case 'browser':
            return ['springboard/platforms/browser'];
        case 'node':
            return ['springboard/platforms/node'];
        case 'partykit':
            return ['springboard/platforms/partykit'];
        case 'tauri':
            return ['springboard/platforms/tauri'];
        case 'react-native':
            return ['springboard/platforms/react-native'];
        default:
            return ['springboard/platforms/browser'];
    }
}
