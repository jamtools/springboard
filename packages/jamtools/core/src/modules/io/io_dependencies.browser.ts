import {BrowserQwertyService} from '@jamtools/core/services/browser/browser_qwerty_service';
import {BrowserMidiService} from '@jamtools/core/services/browser/browser_midi_service';
import type {IoDeps} from './io_dependencies_types.js';

export const createIoDependencies = async (): Promise<IoDeps> => {
    const qwerty = new BrowserQwertyService(document);
    const midi = new BrowserMidiService();
    return {
        qwerty,
        midi,
    };
};
