/**
 * File system utilities for testing
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';

/**
 * Create a temporary directory for testing
 */
export async function createTempDir(prefix: string = 'springboard-test-'): Promise<string> {
  const tempDir = path.join(tmpdir(), `${prefix}${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

/**
 * Clean up a directory recursively
 */
export async function cleanupDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (error) {
    // Ignore errors during cleanup
    console.warn(`Warning: Failed to cleanup directory ${dir}:`, error);
  }
}

/**
 * Copy directory recursively
 */
export async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });

  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a directory exists
 */
export async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Read JSON file
 */
export async function readJson<T = unknown>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content) as T;
}

/**
 * Write JSON file
 */
export async function writeJson(filePath: string, data: unknown): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath, content, 'utf8');
}

/**
 * Find files matching a pattern recursively
 */
export async function findFiles(dir: string, pattern: RegExp): Promise<string[]> {
  const results: string[] = [];

  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const subResults = await findFiles(fullPath, pattern);
      results.push(...subResults);
    } else if (pattern.test(entry.name)) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Get directory size in bytes
 */
export async function getDirSize(dir: string): Promise<number> {
  let size = 0;

  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      size += await getDirSize(fullPath);
    } else {
      const stat = await fs.stat(fullPath);
      size += stat.size;
    }
  }

  return size;
}

/**
 * Create a minimal package.json for testing
 */
export async function createTestPackageJson(
  dir: string,
  overrides: Record<string, unknown> = {}
): Promise<void> {
  const packageJson = {
    name: 'test-app',
    version: '0.0.1',
    private: true,
    type: 'module',
    ...overrides,
  };

  await writeJson(path.join(dir, 'package.json'), packageJson);
}
