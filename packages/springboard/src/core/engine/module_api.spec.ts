import {Springboard} from './engine.js';
import {makeMockCoreDependencies, MockRpcService} from '../test/mock_core_dependencies.js';
import springboard from './register.js';
import React from 'react';
import {defineRoute, defineRoutes} from '../../router/index.js';

describe('ModuleAPI', () => {
    beforeEach(() => {
        springboard.reset();
    });

    it('should create shared state', async () => {
        const coreDeps = makeMockCoreDependencies({store: {}});

        const engine = new Springboard(coreDeps);
        await engine.initialize();

        const mod = await engine.registerModule('TestModule', {}, async (moduleAPI) => {
            const states = await moduleAPI.shared.createSharedStates({
                hey: {yep: 'yeah'}
            });
            return {
                state: states.hey,
            };
        });

        expect(mod.api.state.getState()).toEqual({yep: 'yeah'});
        await mod.api.state.setState({yep: 'nah'});
        expect(mod.api.state.getState()).toEqual({yep: 'nah'});
    });

    it('should refresh shared state from KV on reconnect', async () => {
        const store: Record<string, string> = {};
        const coreDeps = makeMockCoreDependencies({store});

        const engine = new Springboard(coreDeps);
        await engine.initialize();

        const mod = await engine.registerModule('TestModule', {}, async (moduleAPI) => {
            const state = await moduleAPI.shared.createSharedState('count', {value: 1});
            return {
                state,
            };
        });

        store['engine|module|TestModule|state.shared|count'] = JSON.stringify({value: 2});
        await (coreDeps.rpc.remote as MockRpcService).triggerReconnect();

        expect(mod.api.state.getState()).toEqual({value: 2});
    });

    it('should initialize a defined module descriptor', async () => {
        const coreDeps = makeMockCoreDependencies({store: {}});

        const engine = new Springboard(coreDeps);
        engine.registerDescriptor(springboard.defineModule('DefinedModule', {}, async () => {
            return {
                routes: defineRoutes([
                    defineRoute({
                        path: '/defined-module',
                        component: () => null,
                    }),
                ]),
            };
        }));

        await engine.initialize();

        expect(engine.moduleRegistry.getModule('DefinedModule' as never)).toBeTruthy();
    });

    it('should initialize modules registered through an entrypoint descriptor in order', async () => {
        const coreDeps = makeMockCoreDependencies({store: {}});
        const initialized: string[] = [];

        const engine = new Springboard(coreDeps);
        engine.registerDescriptor(springboard.entrypoint(({register}) => {
            register(springboard.defineModule('First', {}, async () => {
                initialized.push('First');
                return {};
            }));
            register(springboard.defineModule('Second', {}, async () => {
                initialized.push('Second');
                return {};
            }));
        }));

        await engine.initialize();

        expect(initialized).toEqual(['First', 'Second']);
    });

    it('should await async entrypoint composition before initializing modules', async () => {
        const coreDeps = makeMockCoreDependencies({store: {}});
        const initialized: string[] = [];

        const engine = new Springboard(coreDeps);
        await engine.registerDescriptor(springboard.entrypoint(async ({register}) => {
            await Promise.resolve();
            await register(springboard.defineModule('AsyncFirst', {}, async () => {
                initialized.push('AsyncFirst');
                return {};
            }));
        }));

        await engine.initialize();

        expect(initialized).toEqual(['AsyncFirst']);
        expect(engine.moduleRegistry.getModule('AsyncFirst' as never)).toBeTruthy();
    });

    it('should register React providers with ranks', async () => {
        const coreDeps = makeMockCoreDependencies({store: {}});
        const extraDeps = {};

        const engine = new Springboard(coreDeps, extraDeps);
        await engine.initialize();

        const TestProvider1 = ({children}: {children: React.ReactNode}) => children;
        const TestProvider2 = ({children}: {children: React.ReactNode}) => children;
        const TestProvider3 = ({children}: {children: React.ReactNode}) => children;

        const mod = await engine.registerModule('TestModule', {}, async (moduleAPI) => {
            moduleAPI.ui.registerReactProvider(TestProvider1); // rank 0 (default)
            moduleAPI.ui.registerReactProvider(TestProvider2, {rank: 'top'}); // rank 100
            moduleAPI.ui.registerReactProvider(TestProvider3, {rank: 'bottom'}); // rank -100
            return {};
        });

        // Access the module directly from the returned result
        expect(mod.module.providers).toBeDefined();
        expect(mod.module.providers).toHaveLength(3);

        // Verify providers are stored with correct ranks
        expect(mod.module.providers?.[0].provider).toBe(TestProvider1);
        expect(mod.module.providers?.[0].rank).toBe(0);

        expect(mod.module.providers?.[1].provider).toBe(TestProvider2);
        expect(mod.module.providers?.[1].rank).toBe(100);

        expect(mod.module.providers?.[2].provider).toBe(TestProvider3);
        expect(mod.module.providers?.[2].rank).toBe(-100);
    });
});
