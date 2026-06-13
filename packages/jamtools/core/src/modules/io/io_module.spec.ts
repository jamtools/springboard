import '../index';

import {Springboard} from 'springboard/engine/engine';
import {makeMockCoreDependencies} from 'springboard/test/mock_core_dependencies';

describe('IoModule', () => {
    it('should initialize with the engine', async () => {
        const coreDeps = makeMockCoreDependencies({store: {}});

        const engine = new Springboard(coreDeps);
        await engine.initialize();

        const ioModule = engine.moduleRegistry.getModule('io');

        expect(ioModule.state).toEqual({
            midiInputDevices: [],
            midiOutputDevices: [],
        });
    });
});
