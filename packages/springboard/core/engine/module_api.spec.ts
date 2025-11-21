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

    it('should register React providers with ranks', async () => {
        const coreDeps = makeMockCoreDependencies({store: {}});
        const extraDeps = makeMockExtraDependences();

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
