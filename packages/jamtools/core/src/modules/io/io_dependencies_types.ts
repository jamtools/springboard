import {MidiService, QwertyService} from '@jamtools/core/types/io_types';

export type IoDeps = {
    midi: MidiService;
    qwerty: QwertyService;
}

export type CreateIoDependencies = () => Promise<IoDeps>;
