import {MockMidiService} from '@jamtools/core/test/services/mock_midi_service';
import {MockQwertyService} from '@jamtools/core/test/services/mock_qwerty_service';
import type {IoDeps} from './io_dependencies_types.js';

// Default implementation for testing
export const createIoDependencies = async (): Promise<IoDeps> => {
    return {
        qwerty: new MockQwertyService(),
        midi: new MockMidiService(),
    };
};
