import React from 'react';
import ReactDOM from 'react-dom/client';

import {CoreDependencies} from '../../../core/types/module_types';

import {Main} from './main';
import {Springboard} from '../../../core/engine/engine';
import {ExtraModuleDependencies} from '../../../core/module_registry/module_registry';

import {watchForChanges} from './esbuild_watch_for_changes';

const waitForPageLoad = () => new Promise<void>(resolve => {
    window.addEventListener('DOMContentLoaded', () => {
        resolve();
    });
});

type BrowserDependencies = Pick<CoreDependencies, 'rpc' | 'storage'> & {
    isLocal?: boolean;
    dev?: {
        reloadCss?: boolean;
        reloadJs?: boolean;
    };
};

export const startAndRenderBrowserApp = async (browserDeps: BrowserDependencies): Promise<Springboard> => {
    const isLocal = browserDeps.isLocal || localStorage.getItem('isLocal') === 'true';

    if ((browserDeps.dev?.reloadCss || browserDeps.dev?.reloadJs) && location.hostname === 'localhost') {
        watchForChanges(browserDeps.dev?.reloadCss, browserDeps.dev?.reloadJs);
    }

    const coreDeps: CoreDependencies = {
        log: console.log,
        showError: (error: string) => alert(error),
        storage: browserDeps.storage,
        rpc: browserDeps.rpc,
        isMaestro: () => isLocal,
    };

    const extraDeps: ExtraModuleDependencies = {
    };

    const engine = new Springboard(coreDeps, extraDeps);

    // await waitForPageLoad();

    const rootElem = document.createElement('div');
    // rootElem.style.overflowY = 'scroll';
    document.body.appendChild(rootElem);

    const root = ReactDOM.createRoot(rootElem);
    root.render(<Main engine={engine} />);

    await engine.waitForInitialize();

    return engine;
};

const createNotImplementedProxy = <ToMock extends object,>(toMock: ToMock) => {
    return new Proxy(toMock, {
        get(target, prop) {
            return () => {
                throw new Error(`${prop.toString()} is not implemented in this environment.`);
            };
        }
    });
};
