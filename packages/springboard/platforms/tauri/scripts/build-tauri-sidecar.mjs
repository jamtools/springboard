import { execSync } from 'child_process';
import fs from 'fs';

const extension = process.platform === 'win32' ? '.exe' : '';

let pkgTarget = process.env.PKG_TARGET || '';
let tauriTarget = process.env.TAURI_TARGET || '';

if (!pkgTarget) {
  throw new Error('Please provide PKG_TARGET environment variable');
}

if (!tauriTarget) {
  const rustInfo = execSync('rustc -vV');
  const targetTriple = /host: (\S+)/g.exec(rustInfo)[1];
  if (!targetTriple) {
    console.error('Failed to determine platform target triple');
  }

  tauriTarget = targetTriple;
}

const shouldAddDebug = false;
const DEBUG = shouldAddDebug ? '--debug' : '';

const pkgCommand = `npx @yao-pkg/pkg ../../dist/tauri/node/dist/index.js --out-path ./src-tauri/binaries --config pkg.json --targets ${pkgTarget} ${DEBUG}`;
execSync(pkgCommand, {stdio: 'inherit'});

fs.renameSync(
  'src-tauri/binaries/index',
  `src-tauri/binaries/local-server-${tauriTarget}${extension}`
);

// example pkg targets
// # nodeRange (node8), node10, node12, node14, node16 or latest
// # platform alpine, linux, linuxstatic, win, macos, (freebsd)
// # arch x64, arm64, (armv6, armv7)
