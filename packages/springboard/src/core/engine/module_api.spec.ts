import {Springboard} from './engine.js';
import {makeMockCoreDependencies, makeMockExtraDependences} from '../test/mock_core_dependencies.js';
import springboard from './register.js';

describe('ModuleAPI', () => {
    beforeEach(() => {
        springboard.reset();
    });

    it('should create shared state', async () => {
        const coreDeps = makeMockCoreDependencies({store: {}});
        const extraDeps = makeMockExtraDependences();

        const engine = new Springboard(coreDeps, extraDeps);
        await engine.initialize();

        const mod = await engine.registerModule('TestModule', {}, async (moduleAPI) => {
            const state = await moduleAPI.statesAPI.createSharedState('hey', {yep: 'yeah'});
            return {
                state,
            };
        });

        expect(mod.api.state.getState()).toEqual({yep: 'yeah'});
        await mod.api.state.setState({yep: 'nah'});
        expect(mod.api.state.getState()).toEqual({yep: 'nah'});
    });

    it('should initialize a defined module descriptor', async () => {
        const coreDeps = makeMockCoreDependencies({store: {}});
        const extraDeps = makeMockExtraDependences();

        const engine = new Springboard(coreDeps, extraDeps);
        engine.registerDescriptor(springboard.defineModule('DefinedModule', {}, async () => {
            return {
                routes: {
                    '': {
                        component: () => null,
                    },
                },
            };
        }));

        await engine.initialize();

        expect(engine.moduleRegistry.getModule('DefinedModule' as never)).toBeTruthy();
    });

    it('should initialize modules registered through an entrypoint descriptor in order', async () => {
        const coreDeps = makeMockCoreDependencies({store: {}});
        const extraDeps = makeMockExtraDependences();
        const initialized: string[] = [];

        const engine = new Springboard(coreDeps, extraDeps);
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
        const extraDeps = makeMockExtraDependences();
        const initialized: string[] = [];

        const engine = new Springboard(coreDeps, extraDeps);
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
});
