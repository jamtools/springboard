import {Subject} from 'rxjs';

import {MidiInputEventPayload, MidiService} from '@jamtools/core/types/io_types';

import {NoteMessageEvent, WebMidi} from 'webmidi';
import {DeviceInfo, MidiEvent, MidiEventFull} from '@jamtools/core/modules/macro_module/macro_module_types';

export class BrowserMidiService implements MidiService {
    private midi!: typeof WebMidi;
    private inputs: Record<string, typeof WebMidi['inputs'][0]> = {};
    private outputs: Record<string, typeof WebMidi['outputs'][0]> = {};

    public onInputEvent = new Subject<MidiInputEventPayload>();
    public onDeviceStatusChange = new Subject<DeviceInfo & {status: 'connected' | 'disconnected'}>();

    initialize = async () => {
        try {
            this.midi = await WebMidi.enable({
                sysex: false,
            });
        } catch (e) {
            console.error('couldnt enable midi: ' + e);
            return;
        }

        for (const input of this.midi.inputs) {
            this.initializeMidiInputDevice(input.name);
        }

        for (const output of this.midi.outputs) {
            this.initializeMidiOutputDevice(output.name);
        }

        this.pollForNewDevices();
    };

    pollForNewDevices = async () => {
        const pluggedInInputs = this.midi.inputs;
        // console.log(pluggedInInputs);

        for (const input of pluggedInInputs) {
            // TODO: implement polling for new devices
        }

        setTimeout(this.pollForNewDevices, 5000);
    };

    private handleNewInput = (inputName: string) => {
        // this.onNewInputDevice.next({newDevice: inputName, allDevices: this.getInputs()});
    };

    private handleNewOutput = (inputName: string) => {
        // this.onNewInputDevice.next({newDevice: inputName, allDevices: this.getInputs()});
    };

    getInputs = (): string[] => {
        return Object.keys(this.inputs);
    };

    getOutputs = (): string[] => {
        return Object.keys(this.outputs);
    };

    private initializeMidiOutputDevice = (outputName: string) => {
        try {
            const existingOutput = this.outputs[outputName];

            if (existingOutput) {
                existingOutput?.close();
            }

            const output = this.midi.outputs.find(o => o.name === outputName)!;
            this.outputs[outputName] = output;
        } catch (e) {
            console.error('failed to initialize midi input device', e);
        }
    };

    public send = (outputName: string, event: MidiEvent) => {
        const output = this.outputs[outputName];
        if (!output) {
            console.error('no midi output found for name ' + outputName);
            return;
        }

        if (event.type === 'noteon') {
            // TODO: support sending multiple midi notes at once. webmidi library supports this it seems
            output.sendNoteOn(event.number, {
                channels: event.channel,
                rawAttack: event.velocity,
            });
        } else if (event.type === 'noteoff') {
            output.sendNoteOff(event.number, {
                channels: event.channel,
            });
        } else if (event.type === 'cc') {
            output.sendControlChange(event.number, event.value, {
                channels: event.channel,
            });
        } else if (event.type === 'program') {
            output.sendProgramChange(event.number, {
                channels: event.channel,
            });
        }
    };

    private initializeMidiInputDevice = (inputName: string) => {
        try {
            const existingInput = this.inputs[inputName];

            if (existingInput) {
                existingInput?.close();
            }

            const input = this.midi.inputs.find(i => i.name === inputName)!;
            this.inputs[inputName] = input;

            const publishMidiEvent = (event: MidiEvent) => {
                const fullEvent: MidiEventFull = {
                    event,
                    type: 'midi',
                    deviceInfo: {
                        type: 'midi',
                        subtype: 'midi_input',
                        name: input.name,
                        manufacturer: '',
                    },
                };

                this.onInputEvent.next(fullEvent);
            };

            const handleNoteEvent = (eventType: 'noteon' | 'noteoff', event: NoteMessageEvent) => {
                const midiEvent: MidiEvent = {
                    type: eventType,
                    channel: event.message.channel,
                    number: event.note.number,
                    velocity: eventType === 'noteon' ? event.note.rawAttack : 0,
                };

                publishMidiEvent(midiEvent);
            };

            input.addListener('noteon', event => {
                handleNoteEvent('noteon', event);
            });
            // on('noteon', (event) => {
            //     handleNoteEvent('noteon', event);
            // });

            input.addListener('noteoff', event => {
                handleNoteEvent('noteoff', event);
            });

            // probably want to use a generic on MidiEvent and MidiEventFull for event types. to have accurate object shapes to expect
            input.addListener('controlchange', (event) => {
                const midiEvent: MidiEvent = {
                    type: 'cc',
                    channel: event.message.channel,
                    number: event.controller.number,
                    value: event.rawValue!,
                };

                // console.log(midiEvent);

                publishMidiEvent(midiEvent);
            });

        } catch (e) {
            console.error('failed to initialize midi input device', e);
        }
    };
}
