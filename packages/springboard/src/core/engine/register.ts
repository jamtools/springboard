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

export type SpringboardRegistry = {
    registerModule: <ModuleOptions extends RegisterModuleOptions, ModuleReturnValue extends object>(
        moduleId: string,
        options: ModuleOptions,
        cb: ModuleCallback<ModuleReturnValue>,
    ) => void;
    registerClassModule: <T extends object>(cb: ClassModuleCallback<T>) => void;
    registerSplashScreen: (component: React.ComponentType) => void;
    reset: () => void;
};

export type RegisterModuleOptions = {
    rpcMode?: 'remote' | 'local';
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

export const springboard: SpringboardRegistry = {
    registerModule,
    registerClassModule,
    registerSplashScreen,
    reset: () => {
        springboard.registerModule = registerModule;
        springboard.registerClassModule = registerClassModule;
        springboard.registerSplashScreen = registerSplashScreen;
        clearRegisteredModules();
        clearRegisteredClassModules();
        clearRegisteredSplashScreen();
    },
};

// Add default export for files that import as: import springboard from './register.js'
export default springboard;
