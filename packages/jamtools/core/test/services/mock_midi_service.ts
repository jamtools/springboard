import {Subject} from 'rxjs';

import {MidiService} from '@jamtools/core/types/io_types';
import {DeviceInfo, MidiEvent, MidiEventFull} from '@jamtools/core/modules/macro_module/macro_module_types';
import {MidiClockService} from '../../services/midi_clock_service';

export class MockMidiService implements MidiService {
    onInputEvent = new Subject<MidiEventFull>();
    onDeviceStatusChange = new Subject<DeviceInfo & {status: 'connected' | 'disconnected'}>();
    private clockService = new MidiClockService();

    initialize = async () => {};

    getInputs = () => [];
    getOutputs = () => [];
    send = (outputName: string, event: MidiEvent) => {};
    getClockService = () => this.clockService;
}
