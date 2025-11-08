import {MIDI_NUMBER_TO_NOTE_NAME_MAPPINGS} from '@jamtools/core/constants/midi_number_to_note_name_mappings';

export type MidiDeviceAndChannel = {
    device: string;
    channel: number;
};

export type HashedMidiDeviceAndChannel<DC extends MidiDeviceAndChannel> = `${DC['device']}-${DC['channel']}`;

export const makeHashedMidiDeviceAndChannel = (device: MidiDeviceAndChannel) => `${device.device}-${device.channel}` as const;

export type MidiDeviceAndChannelMap<Value> = {
    [key: HashedMidiDeviceAndChannel<MidiDeviceAndChannel>]: Value;
}

export type MidiEvent = {
    type: 'noteon' | 'noteoff' | 'cc' | 'program' | 'clock';
    number: number;
    channel: number;
    velocity?: number;
    value?: number;
}

export type BaseMidiEventPayload = Omit<MidiEvent, 'channel'> & {channel?: MidiEvent['channel']};

export const convertMidiNumberToNoteAndOctave = (midiNumber: number): string => {
    const noteName = MIDI_NUMBER_TO_NOTE_NAME_MAPPINGS[(midiNumber % 12) as keyof typeof MIDI_NUMBER_TO_NOTE_NAME_MAPPINGS];

    const octave = Math.ceil((midiNumber + 1) / 12);

    return `${noteName}${octave}` as const;
};

export type DeviceInfo = {
    type: 'midi';
    subtype: 'midi_input' | 'midi_output';
    name: string;
    manufacturer: string;
}

export type MidiEventFull = {
    type: 'midi' | 'ui' | 'qwerty';
    deviceInfo: DeviceInfo;
    event: MidiEvent;
}

export type MacroConfigItemMusicalKeyboardOutput = {
};

export type MacroConfigItem<MacroTypeId extends keyof MacroTypeConfigs> = MacroTypeConfigs[MacroTypeId]['input'];

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface MacroTypeConfigs {}
