/**
 * Execution utilities for running commands in tests
 */

import { exec, spawn, type ChildProcess } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface SpawnedProcess {
  process: ChildProcess;
  waitForOutput: (pattern: string | RegExp, timeoutMs?: number) => Promise<void>;
  waitForExit: (timeoutMs?: number) => Promise<number>;
  kill: () => void;
  output: string;
}

/**
 * Execute a command and return the result
 */
export async function execute(
  command: string,
  options: {
    cwd?: string;
    env?: Record<string, string>;
    timeout?: number;
  } = {}
): Promise<ExecResult> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: options.cwd,
      env: options.env ? { ...process.env, ...options.env } : process.env,
      timeout: options.timeout,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    return {
      stdout: stdout.toString(),
      stderr: stderr.toString(),
      exitCode: 0,
    };
  } catch (error) {
    const err = error as { stdout?: Buffer; stderr?: Buffer; code?: number };
    return {
      stdout: err.stdout?.toString() || '',
      stderr: err.stderr?.toString() || '',
      exitCode: err.code || 1,
    };
  }
}

/**
 * Spawn a long-running process with output tracking
 */
export function spawnProcess(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    env?: Record<string, string>;
  } = {}
): SpawnedProcess {
  let output = '';

  const childProcess = spawn(command, args, {
    cwd: options.cwd,
    env: options.env ? { ...process.env, ...options.env } : process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  childProcess.stdout?.on('data', (data) => {
    output += data.toString();
  });

  childProcess.stderr?.on('data', (data) => {
    output += data.toString();
  });

  const waitForOutput = async (pattern: string | RegExp, timeoutMs = 30000): Promise<void> => {
    const startTime = Date.now();
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    while (Date.now() - startTime < timeoutMs) {
      if (regex.test(output)) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`Timeout waiting for output matching: ${pattern}\nCurrent output:\n${output}`);
  };

  const waitForExit = async (timeoutMs = 30000): Promise<number> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Process did not exit within ${timeoutMs}ms`));
      }, timeoutMs);

      childProcess.on('exit', (code) => {
        clearTimeout(timeout);
        resolve(code || 0);
      });
    });
  };

  const kill = (): void => {
    if (!childProcess.killed) {
      childProcess.kill('SIGTERM');
      setTimeout(() => {
        if (!childProcess.killed) {
          childProcess.kill('SIGKILL');
        }
      }, 5000);
    }
  };

  return {
    process: childProcess,
    waitForOutput,
    waitForExit,
    kill,
    get output() {
      return output;
    },
  };
}

/**
 * Run a build command with proper error handling
 */
export async function runBuild(
  cwd: string,
  env?: Record<string, string>
): Promise<ExecResult> {
  return execute('pnpm build', { cwd, env, timeout: 120000 });
}

/**
 * Run a dev server and wait for it to be ready
 */
export async function runDevServer(
  cwd: string,
  env?: Record<string, string>,
  readyPattern: string | RegExp = /Local:.*http/
): Promise<SpawnedProcess> {
  const devProcess = spawnProcess('pnpm', ['dev'], { cwd, env });

  try {
    await devProcess.waitForOutput(readyPattern, 30000);
  } catch (error) {
    devProcess.kill();
    throw error;
  }

  return devProcess;
}

/**
 * Test if a URL is accessible
 */
export async function urlAccessible(url: string, timeoutMs = 5000): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    clearTimeout(timeout);
    return false;
  }
}

/**
 * Wait for a URL to become accessible
 */
export async function waitForUrl(
  url: string,
  timeoutMs = 30000,
  intervalMs = 500
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await urlAccessible(url, 2000)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`URL ${url} not accessible within ${timeoutMs}ms`);
}
