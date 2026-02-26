import {MidiService, QwertyService} from '@jamtools/core/types/io_types';
import {NodeQwertyService} from '@jamtools/core/services/node/node_qwerty_service';
import {NodeMidiService} from '@jamtools/core/services/node/node_midi_service';
import {MockMidiService} from '@jamtools/core/test/services/mock_midi_service';
import {MockQwertyService} from '@jamtools/core/test/services/mock_qwerty_service';

export type IoDeps = {
    midi: MidiService;
    qwerty: QwertyService;
}

export const createIoDependencies = async (): Promise<IoDeps> => {
    if (process.env.DISABLE_IO === 'true') {
        return {
            qwerty: new MockQwertyService(),
            midi: new MockMidiService(),
        };
    }

    const qwerty = new NodeQwertyService();
    const midi = new NodeMidiService();
    return {
        qwerty,
        midi,
    };
};
