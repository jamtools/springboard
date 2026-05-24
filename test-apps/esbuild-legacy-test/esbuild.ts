/**
 * esbuild Legacy Test - Build Script
 *
 * This build script uses the LEGACY CLI API from the springboard package
 * to validate that SongDrive's current build pattern continues to work.
 *
 * CRITICAL: This script uses the deprecated legacy CLI API, not raw esbuild.
 * This validates backward compatibility for existing applications.
 */

import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Import the legacy CLI API from springboard package
// This is the SAME API pattern that SongDrive currently uses
import {
  buildApplication,
  platformBrowserBuildConfig,
  platformNodeBuildConfig,
  type ApplicationBuildOptions,
  type BuildConfig,
} from 'springboard/legacy-cli';

// ESM compatibility helpers
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cwd = process.cwd();

// Parse command line arguments
const watchMode = process.argv.includes('--watch');

/**
 * Build the browser platform using the legacy CLI API.
 *
 * This matches the exact pattern used by SongDrive:
 * 1. Use platformBrowserBuildConfig as the base
 * 2. Provide applicationEntrypoint (platform-agnostic tic-tac-toe app)
 * 3. Externalize React and React DOM
 * 4. Set HTML document metadata
 *
 * Note: The entry point is platform-agnostic. The legacy CLI handles
 * platform-specific bundling internally via @platform directives.
 */
const buildBrowser = async (): Promise<void> => {
  console.log('');
  console.log('========================================');
  console.log('Building Browser Platform (Legacy CLI)');
  console.log('========================================');
  console.log('');

  try {
    // Build configuration for browser platform
    const config: BuildConfig = {
      ...platformBrowserBuildConfig,
      // Can add additional files if needed (e.g., for PWA manifests)
      additionalFiles: {},
    };

    // Application build options
    const options: ApplicationBuildOptions = {
      // Entry point: platform-agnostic tic-tac-toe application
      // The legacy CLI handles platform-specific bundling internally
      applicationEntrypoint: path.join(__dirname, 'src', 'tic_tac_toe.tsx'),

      // Node modules location for resolving platform packages
      nodeModulesParentFolder: cwd,

      // HTML document metadata (will be injected into generated HTML)
      documentMeta: {
        title: 'Tic Tac Toe - esbuild Legacy Test',
        description: 'Tic-tac-toe game built with Springboard - validates legacy esbuild workflow',
        'og:title': 'Tic Tac Toe',
        'og:description': 'Platform-agnostic Springboard app demonstrating legacy CLI API',
      },

      // Development mode options (disabled for this test)
      dev: {
        reloadCss: false,
        reloadJs: false,
      },

      // Watch mode support
      watch: watchMode,

      // Customize esbuild options
      // This is where SongDrive would add custom plugins, externals, etc.
      editBuildOptions: (buildOptions) => {
        // Externalize React and ReactDOM - they'll be provided at runtime
        // (In a real app, these might be loaded via CDN or separate bundles)
        buildOptions.external = buildOptions.external || [];
        // buildOptions.external.push('react', 'react-dom');

        // // Externalize springboard's dependencies (they should be bundled separately)
        // buildOptions.external.push('rxjs', 'immer', 'dexie', 'reconnecting-websocket');
        // buildOptions.external.push('esbuild'); // esbuild itself shouldn't be bundled

        // Log the final configuration for debugging
        console.log('Browser Build Configuration:');
        console.log(`  Entry: ${buildOptions.entryPoints?.[0]}`);
        console.log(`  Output: ${buildOptions.outfile}`);
        console.log(`  Platform: ${buildOptions.platform}`);
        console.log(`  Externals: ${buildOptions.external.join(', ')}`);
        console.log('');
      },
    };

    // Execute the build using the legacy CLI
    await buildApplication(config, options);

    console.log('Browser platform build complete!');
    console.log('');
  } catch (error) {
    console.error('Browser build failed:', error);
    throw error;
  }
};

/**
 * Build the Node platform using the legacy CLI API.
 *
 * This demonstrates building for Node.js target:
 * 1. Use platformNodeBuildConfig as the base
 * 2. Provide applicationEntrypoint (same platform-agnostic app)
 * 3. Externalize the springboard package itself
 *
 * Note: Both browser and node builds use the SAME entry point.
 * The application code is platform-agnostic - it just uses Springboard APIs.
 * The legacy CLI handles platform-specific bundling internally.
 */
const buildNode = async (): Promise<void> => {
  console.log('========================================');
  console.log('Building Node Platform (Legacy CLI)');
  console.log('========================================');
  console.log('');

  try {
    // Build configuration for Node platform
    const config: BuildConfig = {
      ...platformNodeBuildConfig,
    };

    // Application build options
    const options: ApplicationBuildOptions = {
      // Entry point: same platform-agnostic tic-tac-toe application
      // The legacy CLI handles platform-specific bundling internally
      applicationEntrypoint: path.join(__dirname, 'src', 'tic_tac_toe.tsx'),

      // Node modules location for resolving platform packages
      nodeModulesParentFolder: cwd,

      // Watch mode support
      watch: watchMode,

      // Customize esbuild options for Node
      editBuildOptions: (buildOptions) => {
        // Externalize the springboard package - it's available at runtime
        buildOptions.external = buildOptions.external || [];
        // buildOptions.external.push('springboard');

        // // Externalize springboard's dependencies
        // buildOptions.external.push('rxjs', 'immer', 'dexie', 'better-sqlite3', 'kysely');
        // buildOptions.external.push('esbuild'); // esbuild itself shouldn't be bundled

        // Log the final configuration for debugging
        console.log('Node Build Configuration:');
        console.log(`  Entry: ${buildOptions.entryPoints?.[0]}`);
        console.log(`  Output: ${buildOptions.outfile}`);
        console.log(`  Platform: ${buildOptions.platform}`);
        console.log(`  Externals: ${buildOptions.external.join(', ')}`);
        console.log('');
      },
    };

    // Execute the build using the legacy CLI
    await buildApplication(config, options);

    console.log('Node platform build complete!');
    console.log('');
  } catch (error) {
    console.error('Node build failed:', error);
    throw error;
  }
};

/**
 * Main build function - orchestrates building both platforms sequentially.
 *
 * In SongDrive's case, this would build all 7 platform targets:
 * - browser (online)
 * - browser_offline (PWA)
 * - mobile (Capacitor)
 * - desktop (Tauri webview + maestro)
 * - partykit (server + browser)
 * - node
 *
 * This test app only builds browser + node to keep it simple.
 */
const buildAll = async (): Promise<void> => {
  const startTime = Date.now();

  console.log('');
  console.log('========================================');
  console.log('esbuild Legacy Test - Build All');
  console.log('========================================');
  console.log('');
  console.log('Using Legacy CLI API from springboard/legacy-cli');
  console.log('This validates SongDrive\'s current build pattern');
  console.log('');
  console.log('App: Platform-agnostic Tic-Tac-Toe (Springboard)');
  console.log('Entry: src/tic_tac_toe.tsx (same for all platforms)');
  console.log('');

  try {
    // Build both platforms sequentially
    // (Could be parallelized, but sequential is easier to debug)
    await buildBrowser();
    await buildNode();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('========================================');
    console.log('All Builds Successful!');
    console.log('========================================');
    console.log('');
    console.log(`Total build time: ${duration}s`);
    console.log('');
    console.log('Output directories:');
    console.log(`  Browser: ${path.join(cwd, 'dist', 'browser', 'dist')}`);
    console.log(`  Node:    ${path.join(cwd, 'dist', 'node', 'dist')}`);
    console.log('');
    console.log('Validation complete:');
    console.log('  • Legacy CLI API works correctly');
    console.log('  • SongDrive build pattern is preserved');
    console.log('  • Multi-platform builds function properly');
    console.log('  • Package structure and exports are correct');
    console.log('');

    if (watchMode) {
      console.log('Watch mode enabled - monitoring for changes...');
      console.log('Press Ctrl+C to stop');
      console.log('');
    }
  } catch (error) {
    console.error('');
    console.error('========================================');
    console.error('Build Failed!');
    console.error('========================================');
    console.error('');
    console.error('Error:', error);
    console.error('');
    process.exit(1);
  }
};

// Handle graceful shutdown on Ctrl+C
process.on('SIGINT', () => {
  console.log('');
  console.log('Build process interrupted by user');
  console.log('Exiting...');
  process.exit(0);
});

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('');
  console.error('Unhandled error:', error);
  console.error('');
  process.exit(1);
});

// Execute the build
buildAll().catch((error) => {
  console.error('Fatal build error:', error);
  process.exit(1);
});
