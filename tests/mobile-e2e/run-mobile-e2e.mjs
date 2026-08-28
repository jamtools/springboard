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
const NATIVE_SUFFIX = MODE.replace(/[^A-Za-z0-9_]/g, '');
const APP_PACKAGE = `com.jamtools.springboard.mobilee2e.${NATIVE_SUFFIX}`;
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
      'appium:appPackage': APP_PACKAGE,
      'appium:appActivity': `${APP_PACKAGE}.MainActivity`,
      'appium:appWaitActivity': '*',
      'appium:appWaitDuration': 120000,
      'appium:newCommandTimeout': 240,
      'appium:adbExecTimeout': 120000,
      'appium:androidInstallTimeout': 180000,
      'appium:chromedriverAutodownload': true,
      'appium:ensureWebviewsHavePages': true,
    },
  });

  await ensureAppForeground(driver);

  const rootRoute = await driver.$('~springboard-routing-root-content');
  await rootRoute.waitForDisplayed({ timeout: 120000 });
  const rootRouteText = await rootRoute.getText();
  if (!/Springboard routing root/i.test(rootRouteText)) {
    throw new Error(`Unexpected root route content: ${rootRouteText}`);
  }

  const staticRouteButton = await driver.$('~springboard-routing-open-static');
  await staticRouteButton.waitForDisplayed({ timeout: 30000 });
  await staticRouteButton.click();

  const staticRoute = await driver.$('~springboard-routing-static-content');
  await staticRoute.waitForDisplayed({ timeout: 30000 });
  const staticRouteText = await staticRoute.getText();
  if (!/Springboard static native route/i.test(staticRouteText)) {
    throw new Error(`Unexpected static route content after navigation: ${staticRouteText}`);
  }

  const loadedStatus = await driver.$(`~${EXPECTED_TEST_ID}`);
  await loadedStatus.waitForDisplayed({ timeout: 120000 });
  const loadedText = await loadedStatus.getText();
  if (!EXPECTED_HEADING.test(loadedText) && loadedText !== EXPECTED_TEST_ID) {
    throw new Error(`Unexpected loaded status for ${MODE}: ${loadedText}`);
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
      '--allow-insecure', 'uiautomator2:chromedriver_autodownload,uiautomator2:adb_shell',
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

async function saveScreenshot(driver, filePath) {
  try {
    await driver.saveScreenshot(filePath);
  } catch (error) {
    console.warn('Failed to save screenshot:', error);
  }
}

async function ensureAppForeground(driver) {
  let lastPackage = '';
  let lastActivity = '';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await dismissSystemWaitDialog(driver);
    await driver.activateApp(APP_PACKAGE);
    await delay(5000);
    await dismissSystemWaitDialog(driver);

    lastPackage = await driver.getCurrentPackage().catch(() => '');
    lastActivity = await driver.getCurrentActivity().catch(() => '');
    console.log(`Foreground after launch attempt ${attempt}: ${lastPackage}/${lastActivity}`);
    if (lastPackage === APP_PACKAGE) return;

    await driver.execute('mobile: shell', {
      command: 'am',
      args: ['start', '-W', '-n', `${APP_PACKAGE}/.MainActivity`],
      timeout: 120000,
    }).catch((error) => {
      console.warn(`adb am start failed on attempt ${attempt}:`, error);
    });
    await delay(5000);
  }

  throw new Error(`Expected ${APP_PACKAGE} to be foreground; saw ${lastPackage}/${lastActivity}`);
}

async function dismissSystemWaitDialog(driver) {
  for (const text of ['Wait', 'OK']) {
    const element = await driver.$(`android=new UiSelector().text("${text}")`);
    if (await element.isExisting().catch(() => false)) {
      await element.click().catch(() => undefined);
      await delay(1000);
    }
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
