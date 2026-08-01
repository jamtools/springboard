import {CoreDependencies, ModuleDependencies} from '../types/module_types.js';

import {
    ClassModuleCallback,
    DefinedModuleDescriptor,
    isDefinedModuleDescriptor,
    isEntrypointDescriptor,
    ModuleCallback,
    RegisterModuleOptions,
    springboard,
    SpringboardDescriptor,
    SpringboardEntrypointComposer,
    getRegisteredSplashScreen
} from './register.js';

import React, {createContext, useContext, useState} from 'react';

import {useMount} from '../hooks/useMount.js';
import {AllModules, ExtraModuleDependencies, Module, ModuleRegistry} from '../module_registry/module_registry.js';

import {ServerStateService, SharedStateService} from '../services/states/shared_state_service.js';
import {ModuleAPI} from './module_api.js';

type CapturedRegisterModuleCalls = [string, RegisterModuleOptions, ModuleCallback<any>];
type CapturedRegisterClassModuleCalls = ClassModuleCallback<any>;

const now = () => {
    if (typeof performance !== undefined) {
        return performance.now();
    }

    return new Date().getTime();
};

const logPerformance = (start: number, end: number, message: string) => {
    const duration = getDuration(start, end);
    const endStr = roundDecimal(end);
    if (process.env.DEBUG_LOG_PERFORMANCE) {
        console.log(`sb performance: ${duration}ms ${endStr}ms ${message}`);
    }
};

type ModInitTimeRange = {
    id: string;
    start: number;
    end: number;
}

const logAllPerformance = (times: Record<string, number | ModInitTimeRange[]>) => {
    if (process.env.DEBUG_LOG_PERFORMANCE) {
        console.log('sb performance end', times);
    }
};

const getDuration = (start: number, end: number) => {
    return roundDecimal(end - start);
};

const roundDecimal = (num: number) => {
    return Math.round(num * 100) / 100;
};

export class Springboard {
    public moduleRegistry!: ModuleRegistry;
    private constructorStartTime: number;
    private readonly definedModulesToInitialize: DefinedModuleDescriptor[] = [];
    private readonly pendingEntrypointRegistrations = new Set<Promise<void>>();
    private readonly entrypointComposer: SpringboardEntrypointComposer = {
        register: async (descriptor) => {
            await this.registerDescriptor(descriptor);
        },
    };

    constructor(public coreDeps: CoreDependencies, public extraModuleDependencies: ExtraModuleDependencies = {}) {
        this.constructorStartTime = now();
    }

    private initializeCallbacks: (() => void)[] = [];

    private remoteSharedStateService!: SharedStateService;
    private localSharedStateService!: SharedStateService;
    private sessionSharedStateService?: SharedStateService;
    private serverStateService!: ServerStateService;

    initialize = async () => {
        const initStartTime = now();

        const websocketConnected = await this.coreDeps.rpc.remote.initialize();
        await this.coreDeps.rpc.local?.initialize();
        if (!websocketConnected && !this.coreDeps.isMaestro()) {
            if ('confirm' in globalThis) {
                if (confirm('failed to connect to websocket server. run in local browser mode?')) {
                    this.coreDeps.isMaestro = () => true;
                }
            }
        }

        const websocketConnectedTime = now();
        logPerformance(initStartTime, websocketConnectedTime, 'websocket connected');

        this.remoteSharedStateService = new SharedStateService({
            rpc: this.coreDeps.rpc.remote,
            kv: this.coreDeps.storage.shared,
            log: this.coreDeps.log,
            isMaestro: this.coreDeps.isMaestro,
        });
        await this.remoteSharedStateService.initialize();
        this.coreDeps.rpc.remote.onReconnect?.(async () => {
            await this.remoteSharedStateService.refreshFromKV();
        });

        // Set up reconnection handler to refresh all KV values when websocket reconnects
        if (this.coreDeps.rpc.remote.onReconnect) {
            this.coreDeps.rpc.remote.onReconnect(async () => {
                console.log('Refreshing all KV values after reconnection');
                await this.remoteSharedStateService.refreshAll();
            });
        }

        const remoteSharedStateServiceFinishedTime = now();
        logPerformance(websocketConnectedTime, remoteSharedStateServiceFinishedTime, 'SharedStateService initialized');

        this.localSharedStateService = new SharedStateService({
            rpc: this.coreDeps.rpc.local,
            kv: this.coreDeps.storage.userAgent,
            log: this.coreDeps.log,
            isMaestro: this.coreDeps.isMaestro,
        });
        await this.localSharedStateService.initialize();

        if (this.coreDeps.storage.session) {
            this.sessionSharedStateService = new SharedStateService({
                rpc: this.coreDeps.rpc.local,
                kv: this.coreDeps.storage.session,
                log: this.coreDeps.log,
                isMaestro: this.coreDeps.isMaestro,
            });
            await this.sessionSharedStateService.initialize();
        }

        this.serverStateService = new ServerStateService(this.coreDeps.storage.server);
        if (this.coreDeps.isMaestro()) {
            await this.serverStateService.initialize();
        }

        await this.waitForPendingEntrypointRegistrations();

        this.moduleRegistry = new ModuleRegistry();

        const registeredClassModuleCallbacks = (springboard.registerClassModule as unknown as {calls: CapturedRegisterClassModuleCalls[]}).calls || [];
        springboard.registerClassModule = this.registerClassModule;

        const registeredModuleCallbacks = (springboard.registerModule as unknown as {calls: CapturedRegisterModuleCalls[]}).calls || [];
        springboard.registerModule = this.registerModule;

        const savedTimes: ModInitTimeRange[] = [];

        const handleInitTime = (time: ModInitTimeRange) => {
            savedTimes.push(time);

            const {id, start, end} = time;
            logPerformance(start, end, `${id} module initialized`);
        };

        // TODO: this is not good that classes are unconditionally all registered first. Let's use performance.now() to determine the order of when things were called
        // or put them all in the same array instead of different arrays like they currently are
        for (const definedModule of this.definedModulesToInitialize) {
            const start = now();
            await this.initializeDefinedModule(definedModule);
            const end = now();

            handleInitTime({id: definedModule.moduleId, start, end});
        }

        for (const modClassCallback of registeredClassModuleCallbacks) {
            const start = now(); // would be great to use `using` here to time this
            const mod = await this.registerClassModule(modClassCallback);
            const end = now();

            if (mod) {
                const moduleId = mod.moduleId;
                handleInitTime({id: moduleId, start, end});
            }
        }

        for (const modFuncCallback of registeredModuleCallbacks) {
            const start = now();
            await this.registerModule(modFuncCallback[0], modFuncCallback[1], modFuncCallback[2]);
            const end = now();

            const moduleId = modFuncCallback[0];
            handleInitTime({id: moduleId, start, end});
        }

        const initEndTime = now();

        const relevantTimes = {
            constructorStartTime: this.constructorStartTime,
            initStartTime,
            websocketConnectedTime,
            remoteSharedStateServiceFinishedTime,
            savedTimes,
            initEndTime,
        };

        logAllPerformance(relevantTimes);

        for (const cb of this.initializeCallbacks) {
            cb();
        }
    };

    public registerDescriptor = async (descriptor: SpringboardDescriptor): Promise<void> => {
        if (isDefinedModuleDescriptor(descriptor)) {
            this.definedModulesToInitialize.push(descriptor);
            return;
        }

        if (isEntrypointDescriptor(descriptor)) {
            const registrationPromise = Promise.resolve(descriptor.initialize(this.entrypointComposer));
            this.pendingEntrypointRegistrations.add(registrationPromise);
            try {
                await registrationPromise;
            } finally {
                this.pendingEntrypointRegistrations.delete(registrationPromise);
            }
            return;
        }

        throw new Error('Unknown Springboard descriptor');
    };

    private waitForPendingEntrypointRegistrations = async () => {
        while (this.pendingEntrypointRegistrations.size > 0) {
            const pending = Array.from(this.pendingEntrypointRegistrations);
            await Promise.all(pending);
        }
    };

    private initializeDefinedModule = async <ModuleReturnValue extends object>(
        descriptor: DefinedModuleDescriptor<ModuleReturnValue>,
    ): Promise<{
        module: Module;
        api: ModuleReturnValue
    }> => {
        const mod: Module = {moduleId: descriptor.moduleId};
        const moduleAPI = new ModuleAPI(mod, 'engine', this.coreDeps, this.makeDerivedDependencies(), this.extraModuleDependencies, descriptor.options);
        const moduleReturnValue = await descriptor.initialize(moduleAPI);

        Object.assign(mod, moduleReturnValue);

        this.moduleRegistry.registerModule(mod);
        return {module: mod, api: moduleReturnValue};
    };

    public registerModule = async <ModuleOptions extends RegisterModuleOptions, ModuleReturnValue extends object>(
        moduleId: string,
        options: ModuleOptions,
        cb: ModuleCallback<ModuleReturnValue>,
    ): Promise<{
        module: Module;
        api: ModuleReturnValue
    }> => {
        const mod: Module = {moduleId};
        const moduleAPI = new ModuleAPI(mod, 'engine', this.coreDeps, this.makeDerivedDependencies(), this.extraModuleDependencies, options);
        const moduleReturnValue = await cb(moduleAPI);

        Object.assign(mod, moduleReturnValue);

        this.moduleRegistry.registerModule(mod);
        return {module: mod, api: moduleReturnValue};
    };

    private makeDerivedDependencies = (): ModuleDependencies => {
        return {
            moduleRegistry: this.moduleRegistry,
            toast: (options) => {
                this.coreDeps.log(options.message);
            },
            rpc: this.coreDeps.rpc,
            services: {
                remoteSharedStateService: this.remoteSharedStateService,
                localSharedStateService: this.localSharedStateService,
                sessionSharedStateService: this.sessionSharedStateService,
                serverStateService: this.serverStateService,
            },
        };
    };

    public registerClassModule = async <T extends object,>(cb: ClassModuleCallback<T>): Promise<Module | null> => {
        const modDependencies = this.makeDerivedDependencies();

        const mod = await Promise.resolve(cb(this.coreDeps, modDependencies));

        const moduleAPI = new ModuleAPI(mod, 'engine', this.coreDeps, modDependencies, this.extraModuleDependencies, {});

        if (!isModuleEnabled(mod)) {
            return null;
        }

        await mod.initialize?.(moduleAPI);

        this.moduleRegistry.registerModule(mod);

        return mod;
    };

    public waitForInitialize = (): Promise<void> => {
        return new Promise((resolve) => {
            this.initializeCallbacks.push(() => {
                resolve();
            });
        });
    };
}

const isModuleEnabled = (mod: Module) => {
    // check if module disabled itself with "enabled = false"
    const maybeEnabled = (mod as {enabled?: boolean}).enabled;
    if (maybeEnabled === false) {
        return false;
    }

    return true;
};

export const useSpringboardEngine = () => {
    return useContext(engineContext);
};

/**
 * React hook to access a module by ID from within a component.
 * Use this instead of moduleAPI.getModule() when in React components.
 *
 * @example
 * const audioPlayer = useModule('AudioPlayer');
 * const currentFile = audioPlayer.currentlyPlayingFile.useState();
 */
export const useModule = <ModuleId extends keyof AllModules>(moduleId: ModuleId): AllModules[ModuleId] => {
    const engine = useSpringboardEngine();
    return engine.moduleRegistry.getModule(moduleId);
};

type SpringboardProviderProps = React.PropsWithChildren<{
    engine: Springboard;
}>;

const engineContext = createContext<Springboard>({} as Springboard);

export const SpringboardProvider = (props: SpringboardProviderProps) => {
    const [engine, setEngine] = useState<Springboard | null>(null);

    useMount(async () => {
        await props.engine.initialize();
        setEngine(props.engine);
    });

    if (!engine) {
        const SplashScreenComponent = getRegisteredSplashScreen();
        if (SplashScreenComponent) {
            return <SplashScreenComponent />;
        }

        return (
            <Loader />
        );
    }

    return (
        <SpringboardProviderPure
            engine={engine}
        >
            {props.children}
        </SpringboardProviderPure>
    );
};

export const SpringboardProviderPure = (props: SpringboardProviderProps) => {
    const {engine} = props;
    const mods = engine.moduleRegistry.getModules();

    // Collect all providers with their ranks from all modules
    const allProvidersWithRank: Array<{provider: React.ElementType, rank: number}> = [];

    for (const mod of mods) {
        // Support legacy single Provider property (treat as rank 0)
        if (mod.Provider) {
            allProvidersWithRank.push({
                provider: mod.Provider,
                rank: 0,
            });
        }

        // Collect new providers with their ranks
        if (mod.providers) {
            allProvidersWithRank.push(...mod.providers);
        }
    }

    // Sort by rank descending (higher rank = outer wrapper)
    // Within same rank, maintain registration order (stable sort)
    allProvidersWithRank.sort((a, b) => b.rank - a.rank);

    // Stack providers from lowest rank to highest (so highest rank ends up outermost)
    let stackedProviders: React.ReactNode = props.children;
    for (let i = allProvidersWithRank.length - 1; i >= 0; i--) {
        const Provider = allProvidersWithRank[i]!.provider;
        stackedProviders = (
            <Provider>
                {stackedProviders}
            </Provider>
        );
    }

    return (
        <engineContext.Provider value={engine}>
            {stackedProviders}
        </engineContext.Provider>
    );
};

const Loader = () => {
    return (
        <div style={{display: 'flex', justifyContent: 'center', marginTop: '50px'}}>
            Loading...
        </div>
    );
};
