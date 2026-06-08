import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { remote } from 'webdriverio';

const APPIUM_PORT = Number(process.env.APPIUM_PORT || 4723);
const APPIUM_HOST = process.env.APPIUM_HOST || '127.0.0.1';
const MODE = process.env.SPRINGBOARD_MOBILE_E2E_MODE || 'local-assets';
const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const ARTIFACTS_DIR = path.resolve(REPO_ROOT, 'artifacts/mobile-e2e', MODE);
const SCREENSHOTS_DIR = path.resolve(ARTIFACTS_DIR, 'screenshots');
const APPIUM_LOG = path.resolve(ARTIFACTS_DIR, 'appium.log');
const MOBILE_APK_PATH = process.env.MOBILE_APK_PATH || findFirstApk(ARTIFACTS_DIR);
const EXPECTED_TEST_ID = MODE === 'remote-server'
  ? 'springboard-mobile-remote-server'
  : 'springboard-mobile-local-assets';
const EXPECTED_HEADING = MODE === 'remote-server'
  ? /Springboard remote server loaded/i
  : /Springboard local assets loaded/i;

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

if (!MOBILE_APK_PATH || !fs.existsSync(MOBILE_APK_PATH)) {
  throw new Error(`No APK found. MOBILE_APK_PATH=${MOBILE_APK_PATH || ''}; artifacts=${ARTIFACTS_DIR}`);
}

console.log(`Using APK: ${MOBILE_APK_PATH}`);
console.log(`Mode: ${MODE}`);

const appium = startAppium();
let driver;

try {
  await waitForAppiumStatus();

  driver = await remote({
    hostname: APPIUM_HOST,
    port: APPIUM_PORT,
    path: '/',
    logLevel: 'info',
    capabilities: {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:app': MOBILE_APK_PATH,
      'appium:autoWebview': false,
      'appium:newCommandTimeout': 240,
      'appium:adbExecTimeout': 120000,
      'appium:androidInstallTimeout': 180000,
      'appium:chromedriverAutodownload': true,
      'appium:ensureWebviewsHavePages': true,
    },
  });

  const webviewContext = await waitForWebViewContext(driver);
  await driver.switchContext(webviewContext);

  const main = await driver.$(`[data-testid="${EXPECTED_TEST_ID}"]`);
  await main.waitForDisplayed({ timeout: 120000 });

  const heading = await driver.$('[data-testid="springboard-mobile-heading"]');
  await heading.waitForDisplayed({ timeout: 30000 });
  const headingText = await heading.getText();
  if (!EXPECTED_HEADING.test(headingText)) {
    throw new Error(`Unexpected heading for ${MODE}: ${headingText}`);
  }

  console.log(`Springboard mobile ${MODE} fixture rendered successfully.`);
} catch (error) {
  console.error(error);
  if (driver) {
    await saveScreenshot(driver, path.resolve(SCREENSHOTS_DIR, 'failure.png'));
  }
  process.exitCode = 1;
} finally {
  if (driver) {
    await driver.deleteSession().catch((error) => console.warn('Failed to delete Appium session:', error));
  }
  appium.kill('SIGTERM');
}

function startAppium() {
  const out = fs.openSync(APPIUM_LOG, 'a');
  return spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    [
      'appium',
      '--address', APPIUM_HOST,
      '--port', String(APPIUM_PORT),
      '--base-path', '/',
      '--allow-insecure', 'uiautomator2:chromedriver_autodownload',
    ],
    { cwd: import.meta.dirname, stdio: ['ignore', out, out] },
  );
}

async function waitForAppiumStatus() {
  const statusUrl = `http://${APPIUM_HOST}:${APPIUM_PORT}/status`;
  const start = Date.now();
  let lastError;
  while (Date.now() - start < 60000) {
    try {
      const response = await fetch(statusUrl);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await delay(1000);
  }
  throw new Error(`Timed out waiting for Appium at ${statusUrl}: ${lastError}`);
}

async function waitForWebViewContext(driver) {
  const start = Date.now();
  let lastContexts = [];
  while (Date.now() - start < 120000) {
    lastContexts = await driver.getContexts();
    const webviewContext = lastContexts.find((context) => String(context).startsWith('WEBVIEW'));
    if (webviewContext) return webviewContext;
    await delay(2000);
  }
  throw new Error(`Timed out waiting for WEBVIEW context. Last contexts: ${JSON.stringify(lastContexts)}`);
}

async function saveScreenshot(driver, filePath) {
  try {
    await driver.saveScreenshot(filePath);
  } catch (error) {
    console.warn('Failed to save screenshot:', error);
  }
}

function findFirstApk(root) {
  if (!fs.existsSync(root)) return undefined;
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) queue.push(fullPath);
      if (entry.isFile() && entry.name.endsWith('.apk')) return fullPath;
    }
  }
  return undefined;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
