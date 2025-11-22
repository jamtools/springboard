import {Module} from 'springboard/module_registry/module_registry';
import {CoreDependencies, ModuleDependencies} from 'springboard/types/module_types';
import type {ModuleAPI} from './module_api';
import React from 'react';

export type RegisterRouteOptions = {
    hideApplicationShell?: boolean;
};

export type ModuleCallback<ModuleReturnValue extends object> = (moduleAPI: ModuleAPI) =>
Promise<ModuleReturnValue> | ModuleReturnValue;

export type ClassModuleCallback<T extends object> = (coreDeps: CoreDependencies, modDependencies: ModuleDependencies) =>
Promise<Module<T>> | Module<T>;

export type SpringboardRegistry = {
    registerModule: <ModuleOptions extends RegisterModuleOptions, ModuleReturnValue extends object>(
        moduleId: string,
        options: ModuleOptions,
        cb: ModuleCallback<ModuleReturnValue>,
    ) => void;
    registerClassModule: <T extends object>(cb: ClassModuleCallback<T>) => void;
    registerSplashScreen: (component: React.ComponentType) => void;

    /**
     * Run platform-specific code that is conditionally included in builds.
     *
     * **Build Transformation:** This is a compile-time macro transformed by the esbuild plugin.
     * The transformation happens in `packages/springboard/cli/src/esbuild_plugins/esbuild_plugin_platform_inject.ts`.
     *
     * **How it works:**
     * - **Platform matches:** `springboard.runOn('node', cb)` → `cb()` (IIFE, callback executed immediately)
     * - **Platform doesn't match:** `springboard.runOn('browser', cb)` → `null` (in node build)
     *
     * **Platform Matrix:**
     * | Build Target | Accepts runOn(...) with |
     * |--------------|------------------------|
     * | `node` | `'node'`, `'server'` |
     * | `cf-workers` | `'cf-workers'`, `'server'` |
     * | `web`  | `'web'`, `'browser'`, `'client'`, `'user-agent'` |
     * | `tauri` | `'tauri'`, `'browser'`, `'client'`, `'user-agent'` |
     * | `browser` | `'browser'`, `'web'`, `'tauri'`, `'client'`, `'user-agent'` (meta-target) |
     * | `react-native-web` | `'react-native-web'`, `'browser'`, `'client'` |
     * | `react-native` | `'react-native'`, `'user-agent'` |
     *
     * **Async Support:** Callbacks can be sync or async. Use `await` if the callback returns a Promise:
     * ```typescript
     * const deps = await springboard.runOn('node', async () => {
     *   return await import('node-only-lib');
     * });
     * // Node build: const deps = await (async () => { return await import(...); })();
     * // Browser build: const deps = null;
     * ```
     *
     * **Fallback Pattern:** Use nullish coalescing (`??`) for platform fallbacks:
     * ```typescript
     * const deps = springboard.runOn('node', () => ({midi: true}))
     *           ?? springboard.runOn('browser', () => ({audio: true}));
     * // Node build: const deps = (() => ({midi: true}))() ?? null;
     * // Browser build: const deps = null ?? (() => ({audio: true}))();
     * ```
     *
     * @param platform - Platform name or context that matches the build target (see matrix above)
     * @param callback - Function to execute if platform matches (sync or async)
     * @returns Callback's return value if platform matches, otherwise `null`
     *
     * @example
     * ```typescript
     * // Node-only dependencies (removed from browser builds)
     * const nodeDeps = springboard.runOn('node', () => {
     *   return {fs: require('fs'), path: require('path')};
     * });
     *
     * // Server context (works for both node and cf-workers builds)
     * const serverDeps = springboard.runOn('server', () => {
     *   return {db: connectToDatabase()};
     * });
     *
     * // Browser-only code (removed from server builds)
     * const browserDeps = springboard.runOn('browser', () => {
     *   return {audio: new AudioContext()};
     * });
     * ```
     *
     * @see {@link isPlatform} for runtime platform checks (no compile-time removal)
     */
    runOn: <T>(
        platform: SpringboardPlatform | SpringboardPlatformContext,
        callback: () => T
    ) => T | null;

    /**
     * Check if the current runtime matches a platform or context at runtime.
     *
     * **Runtime Check Only:** Unlike `runOn`, this is NOT transformed at compile time.
     * Code inside `isPlatform` checks is included in all builds. For compile-time
     * code removal, use `runOn` instead.
     *
     * **Platform vs Context:**
     * - **Platforms** are concrete runtimes: `'node'`, `'browser'`, `'react-native'`, etc.
     * - **Contexts** are logical groups: `'server'`, `'client'`, `'user-agent'`
     *
     * **Platform Matrix:**
     * | Build Target | Returns `true` for |
     * |--------------|-------------------|
     * | `node` | `'node'`, `'server'` |
     * | `cf-workers` | `'cf-workers'`, `'server'` |
     * | `web`  | `'web'`, `'browser'`, `'client'`, `'user-agent'` |
     * | `tauri` | `'tauri'`, `'browser'`, `'client'`, `'user-agent'` |
     * | `react-native-webview` | `'browser'`, `'client'`
     * | `react-native` | `'react-native'`, `'user-agent'` |
     *
     * **Implementation:** Transformed by platform macros in build plugin to return
     * `true` for matching platforms, `false` otherwise. Each platform check is wrapped
     * in `@platform` directives for compile-time removal.
     *
     * @param platform - Platform name or context to check
     * @returns `true` if current runtime matches the platform/context
     *
     * @example
     * ```typescript
     * // Check specific platform
     * if (springboard.isPlatform('node')) {
     *   // This code is included in ALL builds but only runs on Node.js
     *   console.log('Running on Node.js');
     * }
     *
     * // Check context (logical grouping)
     * if (springboard.isPlatform('server')) {
     *   // Runs on node OR cf-workers
     *   connectToDatabase();
     * }
     *
     * // Multiple checks
     * const isNodeServer = springboard.isPlatform('server') && springboard.isPlatform('node');
     * ```
     *
     * @see {@link runOn} for compile-time code removal based on platform
     */
    isPlatform: (platform: SpringboardPlatform | SpringboardPlatformContext) => boolean;

    reset: () => void;
};

export type RegisterModuleOptions = {
    rpcMode?: 'remote' | 'local';
};

type CapturedRegisterModuleCall = [string, RegisterModuleOptions, ModuleCallback<any>];

const registerModule = <ModuleOptions extends RegisterModuleOptions, ModuleReturnValue extends object>(
    moduleName: string,
    options: ModuleOptions,
    cb: ModuleCallback<ModuleReturnValue>,
) => {
    const calls = (registerModule as unknown as {calls: CapturedRegisterModuleCall[]}).calls || [];
    calls.push([moduleName, options, cb]);
    (registerModule as unknown as {calls: CapturedRegisterModuleCall[]}).calls = calls;
};

type CapturedRegisterClassModuleCalls = ClassModuleCallback<any>;

const registerClassModule = <T extends object>(cb: ClassModuleCallback<T>) => {
    const calls = (registerClassModule as unknown as {calls: CapturedRegisterClassModuleCalls[]}).calls || [];
    calls.push(cb);
    (registerClassModule as unknown as {calls: CapturedRegisterClassModuleCalls[]}).calls = calls;
};

let registeredSplashScreen: React.ComponentType | null = null;

const registerSplashScreen = (component: React.ComponentType) => {
    registeredSplashScreen = component;
};

export const getRegisteredSplashScreen = (): React.ComponentType | null => {
    return registeredSplashScreen;
};

/**
 * Runtime stub for `springboard.runOn()` - FOR DEVELOPMENT/FALLBACK ONLY.
 *
 * **Expected Behavior:**
 * This function should NEVER be called in production builds. The esbuild plugin
 * (`packages/springboard/cli/src/esbuild_plugins/esbuild_plugin_platform_inject.ts`)
 * transforms all `runOn` calls at compile time:
 *
 * - **Platform matches:** `runOn('node', cb)` → `cb()` (immediate execution)
 * - **Platform doesn't match:** `runOn('browser', cb)` → `null` (removed)
 *
 * **This stub:**
 * - Exists for TypeScript type checking and IDE autocomplete
 * - Provides fallback behavior in non-transformed environments (development, tests)
 * - Simply executes the callback immediately (simulating "platform matches" behavior)
 *
 * **Platform parameter:**
 * Accepts either platform names (`'node'`, `'browser'`, etc.) or contexts (`'server'`, `'client'`, etc.).
 * The esbuild plugin (lines 97-118 of esbuild_plugin_platform_inject.ts) handles the platform
 * matching logic based on the build target using a switch statement.
 *
 * @internal
 */
const runOn = <T>(
    platform: SpringboardPlatform | SpringboardPlatformContext,
    callback: () => T
): T | null => {
    // Development/test fallback: execute callback immediately
    // In production, this code is replaced by the esbuild plugin transformation
    void platform; // Unused in runtime stub
    return callback();
};

const SPRINGBOARD_PLATFORM_CONTEXTS = {
    SERVER: 'server',
    CLIENT: 'client',
    USER_AGENT: 'user-agent',
    BROWSER: 'browser',
} as const;

export type SpringboardPlatformContext = typeof SPRINGBOARD_PLATFORM_CONTEXTS[keyof typeof SPRINGBOARD_PLATFORM_CONTEXTS];

const SPRINGBOARD_PLATFORMS = {
    NODE: 'node',
    CF_WORKERS: 'cf-workers',
    WEB: 'web',
    TAURI: 'tauri',
    REACT_NATIVE: 'react-native',
    REACT_NATIVE_WEBVIEW: 'react-native-web',
} as const;

export type SpringboardPlatform = typeof SPRINGBOARD_PLATFORMS[keyof typeof SPRINGBOARD_PLATFORMS];

/**
 * Runtime platform detection - transformed by `@platform` directives at build time.
 *
 * **How it works:**
 * Each platform check is wrapped in `@platform "..."` directives. The esbuild plugin
 * (`esbuild_plugin_platform_inject.ts`) removes non-matching platform blocks at compile time.
 *
 * **Platform Matrix:**
 * | Build Target | Returns `true` for |
 * |--------------|-------------------|
 * | `node` | `'node'`, `'server'` |
 * | `cf-workers` | `'cf-workers'`, `'server'` |
 * | `web`  | `'web'`, `'browser'`, `'client'`, `'user-agent'` |
 * | `tauri` | `'tauri'`, `'browser'`, `'client'`, `'user-agent'` |
 * | `browser` | `'browser'`, `'web'`, `'tauri'`, `'client'`, `'user-agent'` (meta-target) |
 * | `react-native-web` | `'react-native-web'`, `'browser'`, `'client'` |
 * | `react-native` | `'react-native'`, `'user-agent'` |
 */
const isPlatform = (platform: SpringboardPlatform | SpringboardPlatformContext): boolean => {
    // @platform "node"
    if (
        platform === SPRINGBOARD_PLATFORMS.NODE ||
        platform === SPRINGBOARD_PLATFORM_CONTEXTS.SERVER
    ) {
        return true;
    }
    // @platform end

    // @platform "react-native"
    if (
        platform === SPRINGBOARD_PLATFORMS.REACT_NATIVE ||
        platform === SPRINGBOARD_PLATFORM_CONTEXTS.USER_AGENT
    ) {
        return true;
    }
    // @platform end

    // @platform "browser"
    if (
        platform === SPRINGBOARD_PLATFORM_CONTEXTS.BROWSER ||
        platform === SPRINGBOARD_PLATFORM_CONTEXTS.CLIENT
    ) {
        return true;
    }

    if (
        platform === SPRINGBOARD_PLATFORMS.REACT_NATIVE_WEBVIEW &&
        (window as unknown as {ReactNativeWebview?: unknown}).ReactNativeWebview
    ) {
        return true;
    }

    if (
        platform === SPRINGBOARD_PLATFORMS.WEB // TODO: check if not tauri
    ) {
        return true;
    } else if (
        platform === SPRINGBOARD_PLATFORMS.TAURI // TODO: check for tauri
    ) {
        return true;
    }

    if ((platform as string) === SPRINGBOARD_PLATFORM_CONTEXTS.USER_AGENT) {
        if ((window as unknown as {ReactNativeWebview?: unknown}).ReactNativeWebview) {
            return false;
        }
        return true;
    }
    // @platform end

    return false;
};

export const springboard: SpringboardRegistry = {
    registerModule,
    registerClassModule,
    registerSplashScreen,
    runOn,
    isPlatform,
    reset: () => {
        springboard.registerModule = registerModule;
        springboard.registerClassModule = registerClassModule;
        springboard.registerSplashScreen = registerSplashScreen;
    },
};
