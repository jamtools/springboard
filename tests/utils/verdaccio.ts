/**
 * Verdaccio utilities for E2E testing
 *
 * Manages Verdaccio local npm registry for testing package publish/install workflows
 */

import { spawn, type ChildProcess } from 'child_process';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { setTimeout as sleep } from 'timers/promises';

export interface VerdaccioServer {
  process: ChildProcess;
  port: number;
  url: string;
  stop: () => Promise<void>;
}

const DEFAULT_PORT = 4873;
const VERDACCIO_TIMEOUT = 30000; // 30 seconds to start

/**
 * Start a Verdaccio server for testing
 */
export async function startVerdaccio(
  configPath?: string,
  port: number = DEFAULT_PORT
): Promise<VerdaccioServer> {
  const url = `http://localhost:${port}`;

  // Kill any existing Verdaccio process on this port
  try {
    execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore' });
    await sleep(1000);
  } catch {
    // Ignore errors
  }

  // Start Verdaccio
  const args = ['--listen', `${port}`];
  if (configPath) {
    args.push('--config', configPath);
  }

  const verdaccioProcess = spawn('npx', ['verdaccio', ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  let output = '';
  verdaccioProcess.stdout?.on('data', (data) => {
    output += data.toString();
  });

  verdaccioProcess.stderr?.on('data', (data) => {
    output += data.toString();
  });

  // Wait for Verdaccio to start
  const startTime = Date.now();
  let isReady = false;

  while (!isReady && Date.now() - startTime < VERDACCIO_TIMEOUT) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        isReady = true;
        break;
      }
    } catch {
      // Not ready yet
    }
    await sleep(500);
  }

  if (!isReady) {
    verdaccioProcess.kill();
    throw new Error(`Verdaccio failed to start within ${VERDACCIO_TIMEOUT}ms. Output:\n${output}`);
  }

  const server: VerdaccioServer = {
    process: verdaccioProcess,
    port,
    url,
    stop: async () => {
      return new Promise((resolve) => {
        if (verdaccioProcess.killed) {
          resolve();
          return;
        }

        verdaccioProcess.on('exit', () => {
          resolve();
        });

        verdaccioProcess.kill('SIGTERM');

        // Force kill after 5 seconds
        setTimeout(() => {
          if (!verdaccioProcess.killed) {
            verdaccioProcess.kill('SIGKILL');
          }
        }, 5000);
      });
    },
  };

  return server;
}

/**
 * Configure npm/pnpm to use Verdaccio registry
 */
export function getRegistryEnv(registryUrl: string): Record<string, string> {
  return {
    ...process.env,
    npm_config_registry: registryUrl,
    NPM_CONFIG_REGISTRY: registryUrl,
    PNPM_REGISTRY: registryUrl,
    // Disable strict SSL for local testing
    npm_config_strict_ssl: 'false',
    NODE_TLS_REJECT_UNAUTHORIZED: '0',
  };
}

/**
 * Publish a package to Verdaccio
 */
export async function publishToVerdaccio(
  packageDir: string,
  registryUrl: string
): Promise<void> {
  const env = getRegistryEnv(registryUrl);

  // Create .npmrc for publishing
  const npmrcPath = path.join(packageDir, '.npmrc');
  const npmrcContent = `registry=${registryUrl}
//localhost:4873/:_authToken="dummy-token"
`;
  await fs.writeFile(npmrcPath, npmrcContent);

  try {
    execSync('npm publish --force', {
      cwd: packageDir,
      env,
      stdio: 'pipe',
    });
  } catch (error) {
    const err = error as { message: string; stdout?: Buffer };
    throw new Error(`Failed to publish package: ${err.message}\n${err.stdout?.toString() || ''}`);
  } finally {
    // Clean up .npmrc
    try {
      await fs.unlink(npmrcPath);
    } catch {
      // Ignore
    }
  }
}

/**
 * Install dependencies using Verdaccio registry
 */
export async function installFromVerdaccio(
  projectDir: string,
  registryUrl: string
): Promise<void> {
  const env = getRegistryEnv(registryUrl);

  // Create .npmrc for installation
  const npmrcPath = path.join(projectDir, '.npmrc');
  const npmrcContent = `registry=${registryUrl}
strict-ssl=false
`;
  await fs.writeFile(npmrcPath, npmrcContent);

  try {
    execSync('pnpm install --no-frozen-lockfile', {
      cwd: projectDir,
      env,
      stdio: 'pipe',
    });
  } catch (error) {
    const err = error as { message: string; stdout?: Buffer };
    throw new Error(`Failed to install dependencies: ${err.message}\n${err.stdout?.toString() || ''}`);
  }
}

/**
 * Check if a package exists in Verdaccio
 */
export async function packageExists(
  packageName: string,
  registryUrl: string
): Promise<boolean> {
  try {
    const response = await fetch(`${registryUrl}/${packageName}`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get package info from Verdaccio
 */
export async function getPackageInfo(
  packageName: string,
  registryUrl: string
): Promise<any> {
  const response = await fetch(`${registryUrl}/${packageName}`);
  if (!response.ok) {
    throw new Error(`Package ${packageName} not found in registry`);
  }
  return response.json();
}
