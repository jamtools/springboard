import React, {useEffect, useRef, useState} from 'react';

import {Subject} from 'rxjs';

import type {ModuleAPI} from '../engine/module_api.js';
import type {SpringboardRouteDescriptor} from '../../router/index.js';
import type {RegisteredModules} from '../../register.js';

export type DocumentMeta = {
    title?: string;
    description?: string;
    'Content-Security-Policy'?: string;
    keywords?: string;
    author?: string;
    robots?: string;
    'og:title'?: string;
    'og:description'?: string;
    'og:image'?: string;
    'og:url'?: string;
} & Record<string, string>;

export type NavigationItemConfig = {
    title: string;
    icon: string;
    route: string;
};

export type ProviderWithRank = {
    provider: React.ElementType;
    rank: number;
};

export type Module<State extends object = any> = {
    moduleId: string;
    initialize?: (moduleAPI: ModuleAPI) => void | Promise<void>;
    Provider?: React.ElementType; // Deprecated: use providers array instead
    providers?: ProviderWithRank[];
    state?: State;
    subject?: Subject<State>;
    routes?: readonly SpringboardRouteDescriptor<string, any>[];
    applicationShell?: React.ElementType<React.PropsWithChildren<{modules: Module[]}>>;
};

export type ResolvedModuleValue<TModule> = TModule extends {
    kind: 'defineModule';
    initialize: (...args: any[]) => infer TReturn;
}
    ? Awaited<TReturn>
    : TModule;

// this interface is meant to be extended by applications/plugins through interface merging
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ExtraModuleDependencies {}


type ModuleMap = {[moduleId: string]: Module};

export class ModuleRegistry {
    private modules: Module[] = [];
    private modulesByKey: ModuleMap = {};

    registerModule(mod: Module<any>) {
        this.modules.push(mod);
        this.modulesByKey[mod.moduleId] = mod;

        this.refreshModules();
    }

    getModule<ModuleId extends keyof RegisteredModules>(moduleId: ModuleId): ResolvedModuleValue<RegisteredModules[ModuleId]> {
        return this.modulesByKey[moduleId] as unknown as ResolvedModuleValue<RegisteredModules[ModuleId]>;
    }

    getCustomModule(moduleId: string): Module | undefined {
        return this.modulesByKey[moduleId];
    }

    refreshModules = () => {
        this.modulesSubject.next([...this.modules]);
    };

    getModules() {
        return this.modules;
    }

    modulesSubject: Subject<Module[]> = new Subject();

    useModules = (): Module[] => {
        return useSubject(this.modules, this.modulesSubject);
    };
}

export const useSubject = <T,>(initialData: T, subject: Subject<T>): T => {
    const [data, setData] = useState(initialData);

    const subscription = useRef<ReturnType<typeof subject.subscribe> | null>(null);
    if (!subscription.current) {
        subscription.current = subject.subscribe((newData) => {
            setData(newData);
        });
    }

    useEffect(() => {
        return () => subscription.current!.unsubscribe();
    }, []);

    return data;
};
