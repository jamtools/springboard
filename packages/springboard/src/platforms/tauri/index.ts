/**
 * Springboard Tauri Platform
 * Entry point for Tauri desktop application functionality
 */

// Export Tauri entrypoints
export { startAndRenderBrowserApp as startTauriBrowserApp } from './entrypoints/platform_tauri_browser';
export { default as tauriMaestroEntrypoint } from './entrypoints/platform_tauri_maestro';
export { default as tauriBrowserEntrypoint } from './entrypoints/platform_tauri_browser';
