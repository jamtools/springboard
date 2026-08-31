import {vi} from 'vitest';
import springboard, {Springboard} from 'springboard';
import {makeMockCoreDependencies} from 'springboard/test/mock_core_dependencies';

import {ioModule, setIoDependencyCreator} from './io/io_module.js';
import {macroModule} from './macro_module/macro_module.js';
import {MockMidiService} from '../test/services/mock_midi_service.js';
import {MockQwertyService} from '../test/services/mock_qwerty_service.js';

describe('@jamtools/core/modules', () => {
    beforeEach(() => {
        springboard.reset();
        setIoDependencyCreator(async () => ({
            midi: new MockMidiService(),
            qwerty: new MockQwertyService(),
        }));
    });

    it('does not register modules as an import side effect', async () => {
        vi.resetModules();
        const {default: freshSpringboard, Springboard: FreshSpringboard} = await import('springboard');

        freshSpringboard.reset();
        await import(/* @vite-ignore */ `./index.js?side-effect-test=${Date.now()}`);

        const engine = new FreshSpringboard(makeMockCoreDependencies({store: {}}));
        await engine.initialize();

        expect(engine.moduleRegistry.getModules()).toHaveLength(0);
    });

    it('does not register macro types as an import side effect', async () => {
        vi.resetModules();
        const [{macroTypeRegistry}] = await Promise.all([
            import('./macro_module/registered_macro_types.js'),
            import(/* @vite-ignore */ `./macro_module/macro_handlers/index.js?side-effect-test=${Date.now()}`),
        ]);

        const calls = (macroTypeRegistry.registerMacroType as unknown as {calls?: unknown[]}).calls;
        expect(calls ?? []).toHaveLength(0);
    });

    it('exports individual module descriptors that apps can register explicitly', async () => {
        const engine = new Springboard(makeMockCoreDependencies({store: {}}));
        await engine.registerDescriptor(ioModule);
        await engine.registerDescriptor(macroModule);
        await engine.initialize();

        expect(engine.moduleRegistry.getModule('io').moduleId).toBe('io');
        expect(engine.moduleRegistry.getModule('macro').moduleId).toBe('macro');
    });

    it('exports a Springboard entrypoint descriptor for registering the core JamTools modules', async () => {
        const {registerJamToolsCoreModules} = await import('./index.js');

        const engine = new Springboard(makeMockCoreDependencies({store: {}}));
        await engine.registerDescriptor(registerJamToolsCoreModules);
        await engine.initialize();

        expect(engine.moduleRegistry.getModule('io').moduleId).toBe('io');
        expect(engine.moduleRegistry.getModule('macro').moduleId).toBe('macro');
        expect(engine.moduleRegistry.getModule('chord_families')).toBeTruthy();
        expect(engine.moduleRegistry.getModule('MidiFile')).toBeTruthy();
    });
});
