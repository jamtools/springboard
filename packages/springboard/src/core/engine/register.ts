import {Module, DocumentMeta} from '../module_registry/module_registry.js';
import {CoreDependencies, ModuleDependencies} from '../types/module_types.js';
import type {ModuleAPI} from './module_api.js';
import React from 'react';

export type DocumentMetaFunction = (context: {path: string; params?: Record<string, string>}) => DocumentMeta | Promise<DocumentMeta>;

export type RegisterRouteOptions = {
    hideApplicationShell?: boolean;
    documentMeta?: DocumentMeta | DocumentMetaFunction;
};

export type ModuleCallback<ModuleReturnValue extends object> = (moduleAPI: ModuleAPI) =>
Promise<ModuleReturnValue> | ModuleReturnValue;

export type ClassModuleCallback<T extends object> = (coreDeps: CoreDependencies, modDependencies: ModuleDependencies) =>
Promise<Module<T>> | Module<T>;

export type RegisterModuleOptions = {
    rpcMode?: 'remote' | 'local';
};

export type DefinedModuleDescriptor<ModuleReturnValue extends object = object> = {
    kind: 'defineModule';
    moduleId: string;
    options: RegisterModuleOptions;
    initialize: ModuleCallback<ModuleReturnValue>;
};

export type SpringboardEntrypointComposer = {
    /**
     * Register a nested Springboard application descriptor. Nested entrypoints
     * are allowed and are awaited before engine initialization proceeds.
     */
    register: (descriptor: SpringboardDescriptor) => Promise<void>;
};

export type SpringboardEntrypointCallback = (
    /**
     * Entrypoints are the platform bootstrap surface for a Springboard app.
     * They may perform global/environment setup and async work before
     * registering modules, but registration must be deterministic by the time
     * the returned promise resolves.
     */
    composer: SpringboardEntrypointComposer,
) => void | Promise<void>;

export type SpringboardEntrypointDescriptor = {
    kind: 'entrypoint';
    initialize: SpringboardEntrypointCallback;
};

export type SpringboardDescriptor =
    | DefinedModuleDescriptor
    | SpringboardEntrypointDescriptor;

export type SpringboardRegistry = {
    registerModule: <ModuleOptions extends RegisterModuleOptions, ModuleReturnValue extends object>(
        moduleId: string,
        options: ModuleOptions,
        cb: ModuleCallback<ModuleReturnValue>,
    ) => void;
    registerClassModule: <T extends object>(cb: ClassModuleCallback<T>) => void;
    defineModule: <ModuleOptions extends RegisterModuleOptions, ModuleReturnValue extends object>(
        moduleId: string,
        options: ModuleOptions,
        cb: ModuleCallback<ModuleReturnValue>,
    ) => DefinedModuleDescriptor<ModuleReturnValue>;
    entrypoint: (
        cb: SpringboardEntrypointCallback,
    ) => SpringboardEntrypointDescriptor;
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
     * | `react-native-webview` | `'react-native-webview'`, `'browser'`, `'client'` |
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
    ) => T | undefined;

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
     * | `react-native-webviewview` | `'browser'`, `'client'`
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

export const isDefinedModuleDescriptor = (value: unknown): value is DefinedModuleDescriptor => {
    return typeof value === 'object'
        && value !== null
        && 'kind' in value
        && value.kind === 'defineModule';
};

export const isEntrypointDescriptor = (value: unknown): value is SpringboardEntrypointDescriptor => {
    return typeof value === 'object'
        && value !== null
        && 'kind' in value
        && value.kind === 'entrypoint';
};

export const getApplicationDescriptorFromExports = (
    moduleExports: Record<string, unknown>,
    sourceLabel = 'application entrypoint',
): SpringboardDescriptor => {
    const preferredExport = 'entrypoint' in moduleExports
        ? moduleExports.entrypoint
        : moduleExports.default;

    if (isDefinedModuleDescriptor(preferredExport) || isEntrypointDescriptor(preferredExport)) {
        return preferredExport;
    }

    const inspectedExportName = 'entrypoint' in moduleExports ? 'entrypoint' : 'default';
    const availableExportNames = Object.keys(moduleExports);
    const availableExportsSuffix = availableExportNames.length > 0
        ? ` Available exports: ${availableExportNames.join(', ')}.`
        : ' The module did not export any values.';

    if (typeof preferredExport === 'undefined') {
        throw new Error(
            `Springboard ${sourceLabel} must export a defineModule descriptor or a springboard.entrypoint descriptor from its ${inspectedExportName} export.${availableExportsSuffix}`,
        );
    }

    throw new Error(
        `Springboard ${sourceLabel} exported an unsupported value from its ${inspectedExportName} export. Expected a defineModule descriptor or a springboard.entrypoint descriptor.${availableExportsSuffix}`,
    );
};

type CapturedRegisterModuleCall = [string, RegisterModuleOptions, ModuleCallback<any>];

const getRegisterModuleCalls = (): CapturedRegisterModuleCall[] => {
    const store = registerModule as unknown as {
        calls?: CapturedRegisterModuleCall[];
    };
    return store.calls ? [...store.calls] : [];
};

const setRegisterModuleCalls = (calls: CapturedRegisterModuleCall[]): void => {
    const store = registerModule as unknown as {
        calls?: CapturedRegisterModuleCall[];
    };
    store.calls = calls;
};

const registerModule = <ModuleOptions extends RegisterModuleOptions, ModuleReturnValue extends object>(
    moduleName: string,
    options: ModuleOptions,
    cb: ModuleCallback<ModuleReturnValue>,
) => {
    const calls = getRegisterModuleCalls();
    calls.push([moduleName, options, cb]);
    setRegisterModuleCalls(calls);
};

type CapturedRegisterClassModuleCalls = ClassModuleCallback<any>;

const getRegisterClassModuleCalls = (): CapturedRegisterClassModuleCalls[] => {
    const store = registerClassModule as unknown as {
        calls?: CapturedRegisterClassModuleCalls[];
    };
    return store.calls ? [...store.calls] : [];
};

const setRegisterClassModuleCalls = (calls: CapturedRegisterClassModuleCalls[]): void => {
    const store = registerClassModule as unknown as {
        calls?: CapturedRegisterClassModuleCalls[];
    };
    store.calls = calls;
};

const registerClassModule = <T extends object>(cb: ClassModuleCallback<T>) => {
    const calls = getRegisterClassModuleCalls();
    calls.push(cb);
    setRegisterClassModuleCalls(calls);
};

const defineModule = <ModuleOptions extends RegisterModuleOptions, ModuleReturnValue extends object>(
    moduleId: string,
    options: ModuleOptions,
    cb: ModuleCallback<ModuleReturnValue>,
): DefinedModuleDescriptor<ModuleReturnValue> => {
    return {
        kind: 'defineModule',
        moduleId,
        options,
        initialize: cb,
    };
};

const entrypoint = (
    cb: SpringboardEntrypointCallback,
): SpringboardEntrypointDescriptor => {
    return {
        kind: 'entrypoint',
        initialize: cb,
    };
};

let registeredSplashScreen: React.ComponentType | null = null;

const registerSplashScreen = (component: React.ComponentType) => {
    registeredSplashScreen = component;
};

export const getRegisteredSplashScreen = (): React.ComponentType | null => {
    return registeredSplashScreen;
};

export const clearRegisteredModules = (): void => {
    setRegisterModuleCalls([]);
};

export const clearRegisteredClassModules = (): void => {
    setRegisterClassModuleCalls([]);
};

export const clearRegisteredSplashScreen = (): void => {
    registeredSplashScreen = null;
};

/**
 * Runtime stub for `springboard.runOn()`
 *
 * - **Platform matches:** `runOn('node', cb)` → `cb()` (immediate execution)
 * - **Platform doesn't match:** `runOn('browser', cb)` → `undefined` (removed)
 *
 * **Platform parameter:**
 * Accepts either platform names (`'node'`, `'browser'`, etc.) or contexts (`'server'`, `'client'`, etc.).
 * The esbuild plugin (esbuild_plugin_platform_inject.ts) handles the platform
 * matching logic based on the build target using a switch statement.
 *
 * @internal
 */
const runOn = <T>(
    _platform: SpringboardPlatform | SpringboardPlatformContext,
    callback: () => T
): T | undefined => {
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
    REACT_NATIVE_WEBVIEW: 'react-native-webview',
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
 * | `react-native-webview` | `'react-native-webview'`, `'browser'`, `'client'` |
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
    defineModule,
    entrypoint,
    registerSplashScreen,
    runOn,
    isPlatform,
    reset: () => {
        springboard.registerModule = registerModule;
        springboard.registerClassModule = registerClassModule;
        springboard.defineModule = defineModule;
        springboard.entrypoint = entrypoint;
        springboard.registerSplashScreen = registerSplashScreen;
        clearRegisteredModules();
        clearRegisteredClassModules();
        clearRegisteredSplashScreen();
    },
};

// Add default export for files that import as: import springboard from './register.js'
export default springboard;
