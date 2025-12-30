import {Subject} from 'rxjs';

import {MidiService} from '@jamtools/core/types/io_types';
import {DeviceInfo, MidiEvent, MidiEventFull} from '@jamtools/core/modules/macro_module/macro_module_types';

export class MockMidiService implements MidiService {
    onInputEvent = new Subject<MidiEventFull>();
    onDeviceStatusChange = new Subject<DeviceInfo & {status: 'connected' | 'disconnected'}>();

    initialize = async () => {};

    getInputs = () => [];
    getOutputs = () => [];
    send = (outputName: string, event: MidiEvent) => {};
}
