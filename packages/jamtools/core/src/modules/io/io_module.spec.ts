import {Springboard} from 'springboard/engine/engine';
import {makeMockCoreDependencies} from 'springboard/test/mock_core_dependencies';
import {ioModule} from './io_module.js';

describe('IoModule', () => {
    it('should initialize with the engine', async () => {
        const coreDeps = makeMockCoreDependencies({store: {}});

        const engine = new Springboard(coreDeps);
        await engine.registerDescriptor(ioModule);
        await engine.initialize();

        const registeredIoModule = engine.moduleRegistry.getModule('io');

        expect(registeredIoModule.state).toEqual({
            midiInputDevices: [],
            midiOutputDevices: [],
        });
    });
});
