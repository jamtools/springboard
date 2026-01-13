#!/usr/bin/env node

/**
 * Automatically generate package.json exports from the dist directory
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SPRINGBOARD_DIR = join(__dirname, '..');
const DIST_DIR = join(SPRINGBOARD_DIR, 'dist');
const PACKAGE_JSON_PATH = join(SPRINGBOARD_DIR, 'package.json');

// Files/directories to always include
const ALWAYS_INCLUDE = [
  'index',
  'core/index',
  'server/index',
  'server/register',
  'platforms/browser/index',
  'platforms/node/index',
  'platforms/partykit/index',
  'platforms/tauri/index',
  'platforms/react-native/index',
  'data-storage/index',
  'legacy-cli/index',
];

// Patterns for files to auto-export (without index.js)
const AUTO_EXPORT_PATTERNS = [
  /^core\/engine\/.+$/,
  /^core\/module_registry\/.+$/,
  /^core\/modules\/.+$/,
  /^core\/services\/.+$/,
  /^core\/test\/.+$/,
  /^core\/types\/.+$/,
  /^core\/utils\/.+$/,
  /^platforms\/.+\/entrypoints\/.+$/,
  /^platforms\/.+\/services\/.+$/,
  /^legacy-cli\/esbuild-plugins\/.+$/,
];

function getAllJsFiles(dir, baseDir = dir) {
  const results = [];

  try {
    const files = readdirSync(dir);

    for (const file of files) {
      const filePath = join(dir, file);
      const stat = statSync(filePath);

      if (stat.isDirectory()) {
        results.push(...getAllJsFiles(filePath, baseDir));
      } else if (file.endsWith('.js') && !file.endsWith('.map')) {
        const relativePath = relative(baseDir, filePath);
        // Remove .js extension and convert to forward slashes
        const pathWithoutExt = relativePath.replace(/\.js$/, '').split(sep).join('/');
        results.push(pathWithoutExt);
      }
    }
  } catch (err) {
    // Directory doesn't exist, skip it
  }

  return results;
}

function shouldExport(path) {
  // Always include specific paths
  if (ALWAYS_INCLUDE.includes(path)) {
    return true;
  }

  // Check against patterns
  return AUTO_EXPORT_PATTERNS.some(pattern => pattern.test(path));
}

function generateExports() {
  const allPaths = getAllJsFiles(DIST_DIR);
  const exportsToGenerate = allPaths.filter(shouldExport);

  console.log(`Found ${allPaths.length} JS files in dist/`);
  console.log(`Generating exports for ${exportsToGenerate.length} files`);

  const exports = {
    '.': {
      types: './dist/index.d.ts',
      import: './dist/index.js',
    },
  };

  // Sort exports for consistent ordering
  exportsToGenerate.sort().forEach(path => {
    if (path === 'index') return; // Already added as "."

    const exportPath = `./${path}`;
    const distPath = `./dist/${path}`;

    exports[exportPath] = {
      types: `${distPath}.d.ts`,
      import: `${distPath}.js`,
    };
  });

  // Add legacy path aliases for backwards compatibility
  // Map old paths (without core/) to new paths (with core/)
  const legacyAliases = {
    './services/http_kv_store_client': './core/services/http_kv_store_client',
    './engine/register': './core/engine/register',
    './engine/engine': './core/engine/engine',
    './engine/module_api': './core/engine/module_api',
    './module_registry/module_registry': './core/module_registry/module_registry',
    './services/states/shared_state_service': './core/services/states/shared_state_service',
    './types/module_types': './core/types/module_types',
    './types/response_types': './core/types/response_types',
    './utils/generate_id': './core/utils/generate_id',
  };

  for (const [legacyPath, newPath] of Object.entries(legacyAliases)) {
    if (exports[newPath]) {
      // Create an alias that points to the same files
      exports[legacyPath] = exports[newPath];
    }
  }

  // Add special cases
  exports['./platforms/browser/index.html'] = './src/platforms/browser/index.html';
  exports['./vite-plugin'] = {
    types: './vite-plugin/dist/index.d.ts',
    import: './vite-plugin/dist/index.js',
  };
  exports['./package.json'] = './package.json';

  return exports;
}

function updatePackageJson() {
  const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  const newExports = generateExports();

  packageJson.exports = newExports;

  writeFileSync(
    PACKAGE_JSON_PATH,
    JSON.stringify(packageJson, null, 2) + '\n',
    'utf8'
  );

  console.log(`Updated package.json with ${Object.keys(newExports).length} exports`);
}

// Run the script
updatePackageJson();
