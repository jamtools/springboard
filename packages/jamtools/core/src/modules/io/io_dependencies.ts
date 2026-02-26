import {MidiService, QwertyService} from '@jamtools/core/types/io_types';
import {MockMidiService} from '@jamtools/core/test/services/mock_midi_service';
import {MockQwertyService} from '@jamtools/core/test/services/mock_qwerty_service';

export type IoDeps = {
    midi: MidiService;
    qwerty: QwertyService;
}

// Default implementation for testing
export const createIoDependencies = async (): Promise<IoDeps> => {
    return {
        qwerty: new MockQwertyService(),
        midi: new MockMidiService(),
    };
};
