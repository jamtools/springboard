import {Springboard} from 'springboard/engine/engine';
import {makeMockCoreDependencies, makeMockExtraDependences} from 'springboard/test/mock_core_dependencies';
import springboard from 'springboard';

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

    it('should register React providers', async () => {
        const coreDeps = makeMockCoreDependencies({store: {}});
        const extraDeps = makeMockExtraDependences();

        const engine = new Springboard(coreDeps, extraDeps);
        await engine.initialize();

        const TestProvider1 = ({children}: {children: React.ReactNode}) => children;
        const TestProvider2 = ({children}: {children: React.ReactNode}) => children;

        const mod = await engine.registerModule('TestModule', {}, async (moduleAPI) => {
            moduleAPI.ui.registerReactProvider(TestProvider1);
            moduleAPI.ui.registerReactProvider(TestProvider2);
            return {};
        });

        // Access the module directly from the returned result
        expect(mod.module.providers).toBeDefined();
        expect(mod.module.providers).toHaveLength(2);
        expect(mod.module.providers?.[0]).toBe(TestProvider1);
        expect(mod.module.providers?.[1]).toBe(TestProvider2);
    });
});
