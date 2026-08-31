import springboard from 'springboard';
import {chordFamiliesModule} from './chord_families/chord_families_module.js';
import {ioModule} from './io/io_module.js';
import {macroModule} from './macro_module/macro_module.js';
import {midiFilesModule} from './midi_files/midi_files_module.js';

export {chordFamiliesModule} from './chord_families/chord_families_module.js';
export {ioModule, IoModule, setIoDependencyCreator} from './io/io_module.js';
export {macroModule, defineMacroModule, MacroModule} from './macro_module/macro_module.js';
export {midiFilesModule} from './midi_files/midi_files_module.js';

export const jamToolsCoreModules = [
    ioModule,
    macroModule,
    chordFamiliesModule,
    midiFilesModule,
] as const;

export const registerJamToolsCoreModules = springboard.entrypoint(async ({register}) => {
    for (const moduleDescriptor of jamToolsCoreModules) {
        await register(moduleDescriptor);
    }
});

export default registerJamToolsCoreModules;
