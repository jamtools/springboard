import React, {createContext} from 'react';

import {Subject} from 'rxjs';

// @ts-ignore: This line suppresses an issue with missing types in wled-client
import {WLEDClient} from 'wled-client';

import {CoreDependencies, ModuleDependencies} from 'springboard/types/module_types';
import {BaseModule, ModuleHookValue} from 'springboard/modules/base_module/base_module';
import {Module} from 'springboard/module_registry/module_registry';

import springboard from 'springboard';

type WledClientStatus = {
    url: string;
    connectionState: string;
}

type WledClientUrlPair = {
    url: string;
    client: WLEDClient;
}

type WledState = {
    controllers: WledClientStatus[];
};

type WledHookValue = ModuleHookValue<WledModule>;

const WledContext = createContext<WledHookValue>({} as WledHookValue);

springboard.registerClassModule((coreDeps: CoreDependencies, modDependencies: ModuleDependencies) => {
    return new WledModule(coreDeps, modDependencies);
});

declare module 'springboard/module_registry/module_registry' {
    interface AllModules {
        wled: WledModule;
    }
}

// TODO: proxy wled UI in jamtools UI
export class WledModule implements Module<WledState> {
    moduleId = 'wled';

    enabled = false;

    cleanup: (() => void)[] = [];

    routes = {
        '': {
            component: () => {
                const mod = WledModule.use();

                return (
                    <pre>
                        {JSON.stringify(mod.state)}
                    </pre>
                );
            },
        },
    };

    // wled controllers need to be stored as hostnames,
    // so they are readable and stay consistent for that controller
    state: WledState = {
        controllers: [
            {
                url: '192.168.0.123',
                connectionState: 'connecting',
            },
        ]
    };

    clients: WledClientUrlPair[] = [];

    initialize = async () => {
        setTimeout(this.initializeClients);

        const ioModule = this.moduleDeps.moduleRegistry.getModule('io');

        const sub = ioModule.qwertyInputSubject.subscribe(event => {
            if (event.key === 'w') {
                this.doSomething();
            }
        });

        this.cleanup.push(sub.unsubscribe);
    };

    private initializeClients = async () => {
        for (const controller of this.state.controllers) {
            try {
                const client = new WLEDClient(controller.url);
                await client.connect();
                controller.connectionState = 'connected';

                this.clients.push({
                    url: controller.url,
                    client,
                });
            } catch (e) {
                controller.connectionState = 'failed: ' + e;
            }
        }

        this.setState({...this.state});
    };

    private currentPalette = 0;

    private doSomething = () => {
        for (const clientPair of this.clients) {
            this.currentPalette = (this.currentPalette + 1) % clientPair.client.palettes.length;
            clientPair.client.setPalette(this.currentPalette);
        }
    };

    Provider: React.ElementType = BaseModule.Provider(this, WledContext);
    static use = BaseModule.useModule(WledContext);
    private setState = BaseModule.setState(this);

    constructor(private coreDeps: CoreDependencies, private moduleDeps: ModuleDependencies) {}
}
