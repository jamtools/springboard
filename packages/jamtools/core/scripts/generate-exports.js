#!/usr/bin/env node

/**
 * Generate and verify the public @jamtools/core package export map.
 *
 * This intentionally preserves the existing hand-authored public subpaths. If a
 * current export cannot be backed by dist files, fail instead of silently
 * pruning it from package.json.
 */

import {existsSync, readFileSync, writeFileSync} from 'fs';
import {dirname, join} from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PACKAGE_DIR = join(__dirname, '..');
const DIST_DIR = join(PACKAGE_DIR, 'dist');
const PACKAGE_JSON_PATH = join(PACKAGE_DIR, 'package.json');

const JS_EXPORTS = [
  ['.', 'index'],
  ['./modules', 'modules/index'],
  ['./constants/midi_number_to_note_name_mappings', 'constants/midi_number_to_note_name_mappings'],
  ['./modules/chord_families/chord_families_module', 'modules/chord_families/chord_families_module'],
  ['./modules/io/io_module', 'modules/io/io_module'],
  ['./modules/macro_module/macro_handlers', 'modules/macro_module/macro_handlers/index'],
  ['./modules/macro_module/macro_handlers/inputs/midi_button_input_macro_handler', 'modules/macro_module/macro_handlers/inputs/midi_button_input_macro_handler'],
  ['./modules/macro_module/macro_handlers/inputs/midi_control_change_input_macro_handler', 'modules/macro_module/macro_handlers/inputs/midi_control_change_input_macro_handler'],
  ['./modules/macro_module/macro_handlers/inputs/musical_keyboard_input_macro_handler', 'modules/macro_module/macro_handlers/inputs/musical_keyboard_input_macro_handler'],
  ['./modules/macro_module/macro_handlers/inputs/musical_keyboard_paged_octave_input_macro_handler', 'modules/macro_module/macro_handlers/inputs/musical_keyboard_paged_octave_input_macro_handler'],
  ['./modules/macro_module/macro_handlers/outputs/midi_button_output_macro_handler', 'modules/macro_module/macro_handlers/outputs/midi_button_output_macro_handler'],
  ['./modules/macro_module/macro_handlers/outputs/midi_control_change_output_macro_handler', 'modules/macro_module/macro_handlers/outputs/midi_control_change_output_macro_handler'],
  ['./modules/macro_module/macro_handlers/outputs/musical_keyboard_output_macro_handler', 'modules/macro_module/macro_handlers/outputs/musical_keyboard_output_macro_handler'],
  ['./modules/macro_module/macro_module', 'modules/macro_module/macro_module'],
  ['./modules/macro_module/macro_module_types', 'modules/macro_module/macro_module_types'],
  ['./modules/midi_files/midi_file_parser/midi_file_parser', 'modules/midi_files/midi_file_parser/midi_file_parser'],
  ['./modules/midi_files/midi_files_module', 'modules/midi_files/midi_files_module'],
  ['./modules/macro_module/registered_macro_types', 'modules/macro_module/registered_macro_types'],
  ['./services/browser/browser_midi_service', 'services/browser/browser_midi_service'],
  ['./services/browser/browser_qwerty_service', 'services/browser/browser_qwerty_service'],
  ['./services/node/node_midi_service', 'services/node/node_midi_service'],
  ['./services/node/node_qwerty_service', 'services/node/node_qwerty_service'],
  ['./test/services/mock_midi_service', 'test/services/mock_midi_service'],
  ['./test/services/mock_qwerty_service', 'test/services/mock_qwerty_service'],
  ['./types/io_types', 'types/io_types'],
];

function assertFileExists(relativePath) {
  const absolutePath = join(PACKAGE_DIR, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Expected generated export target to exist: ${relativePath}`);
  }
}

function makeJsExport(distPath) {
  const types = `./dist/${distPath}.d.ts`;
  const js = `./dist/${distPath}.js`;
  assertFileExists(types);
  assertFileExists(js);
  return {
    types,
    import: js,
  };
}

function makeIoDependenciesExport() {
  const types = './dist/modules/io/io_dependencies_types.d.ts';
  const node = './dist/modules/io/io_dependencies.node.js';
  const browser = './dist/modules/io/io_dependencies.browser.js';
  const fallback = './dist/modules/io/io_dependencies.js';

  assertFileExists(types);
  assertFileExists(node);
  assertFileExists(browser);
  assertFileExists(fallback);

  return {
    types,
    node: {
      import: node,
    },
    browser: {
      import: browser,
    },
    default: {
      import: fallback,
    },
  };
}

function generateExports() {
  if (!existsSync(DIST_DIR)) {
    throw new Error('dist directory does not exist. Run `npm run build` before generating exports.');
  }

  const exports = {};
  for (const [exportPath, distPath] of JS_EXPORTS) {
    exports[exportPath] = makeJsExport(distPath);
  }

  exports['./modules/io/io_dependencies'] = makeIoDependenciesExport();

  return Object.fromEntries(
    Object.entries(exports).sort(([left], [right]) => {
      if (left === '.') return -1;
      if (right === '.') return 1;
      return left.localeCompare(right);
    }),
  );
}

function packageJsonWithGeneratedExports() {
  const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  return {
    ...packageJson,
    exports: generateExports(),
  };
}

function stringifyPackageJson(packageJson) {
  return JSON.stringify(packageJson, null, 2) + '\n';
}

function updatePackageJson() {
  const packageJson = packageJsonWithGeneratedExports();
  writeFileSync(PACKAGE_JSON_PATH, stringifyPackageJson(packageJson), 'utf8');
  console.log(`Updated package.json with ${Object.keys(packageJson.exports).length} exports`);
}

function checkPackageJson() {
  const currentPackageJson = readFileSync(PACKAGE_JSON_PATH, 'utf8');
  const nextPackageJson = stringifyPackageJson(packageJsonWithGeneratedExports());

  if (currentPackageJson !== nextPackageJson) {
    console.error('package.json exports are stale. Run `npm run generate-exports --prefix packages/jamtools/core` and commit the result before tagging.');
    process.exit(1);
  }

  console.log('package.json exports are up to date');
}

try {
  if (process.argv.includes('--check')) {
    checkPackageJson();
  } else {
    updatePackageJson();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
