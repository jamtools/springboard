import {Springboard} from './engine.js';
import {makeMockCoreDependencies, makeMockExtraDependences, MockRpcService} from '../test/mock_core_dependencies.js';
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

    it('should refresh persistent state from KV on reconnect', async () => {
        const store: Record<string, string> = {};
        const coreDeps = makeMockCoreDependencies({store});
        const extraDeps = makeMockExtraDependences();

        const engine = new Springboard(coreDeps, extraDeps);
        await engine.initialize();

        const mod = await engine.registerModule('TestModule', {}, async (moduleAPI) => {
            const state = await moduleAPI.statesAPI.createPersistentState('count', {value: 1});
            return {
                state,
            };
        });

        store['engine|module|TestModule|state.persistent|count'] = JSON.stringify({value: 2});
        await (coreDeps.rpc.remote as MockRpcService).triggerReconnect();

        expect(mod.api.state.getState()).toEqual({value: 2});
    });
});
