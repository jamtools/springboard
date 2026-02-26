import {MidiService, QwertyService} from '@jamtools/core/types/io_types';
import {BrowserQwertyService} from '@jamtools/core/services/browser/browser_qwerty_service';
import {BrowserMidiService} from '@jamtools/core/services/browser/browser_midi_service';

export type IoDeps = {
    midi: MidiService;
    qwerty: QwertyService;
}

export const createIoDependencies = async (): Promise<IoDeps> => {
    const qwerty = new BrowserQwertyService(document);
    const midi = new BrowserMidiService();
    return {
        qwerty,
        midi,
    };
};
