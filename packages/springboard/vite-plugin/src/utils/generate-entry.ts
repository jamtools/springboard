/**
 * Generate Entry Utility
 *
 * Generates virtual entry point code for different platforms.
 * Uses template files for consistent entry generation.
 */

import type { NormalizedOptions, Platform } from '../types.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import * as path from 'path';

/**
 * Template loading functions
 *
 * These functions load template files from src/templates/ directory.
 * The path resolution ensures templates are found when running from compiled dist/ directory.
 */

/**
 * Load the browser dev entry template
 */
export function loadBrowserDevTemplate(): string {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const templatePath = path.resolve(currentDir, '../../src/templates/browser-dev-entry.template.ts');
    return readFileSync(templatePath, 'utf-8');
}

/**
 * Load the browser build entry template
 */
export function loadBrowserBuildTemplate(): string {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const templatePath = path.resolve(currentDir, '../../src/templates/browser-build-entry.template.ts');
    return readFileSync(templatePath, 'utf-8');
}

/**
 * Load the node entry template
 */
export function loadNodeTemplate(): string {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const templatePath = path.resolve(currentDir, '../../src/templates/node-entry.template.ts');
    return readFileSync(templatePath, 'utf-8');
}

/**
 * Load the HTML template
 */
export function loadHtmlTemplate(): string {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const templatePath = path.resolve(currentDir, '../../src/templates/index.template.html');
    return readFileSync(templatePath, 'utf-8');
}

/**
 * Template-based entry generation functions
 */

/**
 * Generate browser dev entry code with user entry path injected
 * @param userEntryPath - Relative path to user's entry file
 * @returns Generated JavaScript code
 */
export function generateBrowserDevEntry(userEntryPath: string): string {
    const template = loadBrowserDevTemplate();
    return template.replace('__USER_ENTRY__', userEntryPath);
}

/**
 * Generate browser build entry code with user entry path injected
 * @param userEntryPath - Relative path to user's entry file
 * @returns Generated JavaScript code
 */
export function generateBrowserBuildEntry(userEntryPath: string): string {
    const template = loadBrowserBuildTemplate();
    return template.replace('__USER_ENTRY__', userEntryPath);
}

/**
 * Generate node entry code with user entry path and port injected
 * @param userEntryPath - Relative path to user's entry file
 * @param port - Port number for the node server (default: 3000)
 * @returns Generated TypeScript code
 */
export function generateNodeEntry(userEntryPath: string, port: number = 3000): string {
    const template = loadNodeTemplate();
    return template
        .replace('__USER_ENTRY__', userEntryPath)
        .replace('__PORT__', String(port));
}

/**
 * Generate HTML with title and description injected
 * @param title - Page title (default: 'Springboard App')
 * @param description - Page description (optional)
 * @returns Generated HTML
 */
export function generateHtml(title?: string, description?: string): string {
    const template = loadHtmlTemplate();
    const pageTitle = title || 'Springboard App';
    const descriptionMeta = description
        ? `<meta name="description" content="${description}">`
        : '';

    return template
        .replace('{{TITLE}}', pageTitle)
        .replace('{{DESCRIPTION_META}}', descriptionMeta);
}

/**
 * Generate the virtual entry point code for the current platform.
 *
 * The entry point chains:
 * 1. Platform-specific core initialization
 * 2. User's application entrypoint
 *
 * @deprecated Use template-based entry generation functions instead
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
            return generateLegacyBrowserEntry(resolvedEntry);
        case 'node':
            return generateLegacyNodeEntry(resolvedEntry);
        case 'partykit':
            return generatePartykitEntry(resolvedEntry);
        case 'tauri':
            return generateTauriEntry(resolvedEntry);
        case 'react-native':
            return generateReactNativeEntry(resolvedEntry);
        default:
            return generateLegacyBrowserEntry(resolvedEntry);
    }
}

/**
 * Generate browser entry point (legacy)
 * @deprecated Use generateBrowserDevEntry or generateBrowserBuildEntry instead
 */
function generateLegacyBrowserEntry(entry: string): string {
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
 * Generate Node.js entry point (legacy)
 * @deprecated Use generateNodeEntry instead (loads from template)
 */
function generateLegacyNodeEntry(entry: string): string {
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
