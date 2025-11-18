import React from 'react';

import {MidiDeviceAndChannelMap, MidiEvent, MidiEventFull, makeHashedMidiDeviceAndChannel} from '../../macro_module_types';
import {QwertyCallbackPayload} from '../../../../types/io_types';
import {QWERTY_TO_MIDI_MAPPINGS} from '../../../../constants/qwerty_to_midi_mappings';
import {InputMacroStateHolders, MidiInputMacroPayload, getKeyForMacro, getKeyForMidiEvent, useInputMacroWaiterAndSaver} from './input_macro_handler_utils';
import {macroTypeRegistry} from '../../registered_macro_types';

type MusicalKeyboardInputResult = MidiInputMacroPayload;

type MacroConfigItemMusicalKeyboardInput = {
    onTrigger?(midiEvent: MidiEventFull): void;
    enableQwerty?: boolean;
    eventTypes?: MidiEvent['type'][];
}

declare module '../../macro_module_types' {
    interface MacroTypeConfigs {
        musical_keyboard_input: {
            input: MacroConfigItemMusicalKeyboardInput;
            output: MusicalKeyboardInputResult;
        }
    }
}

type MusicalKeyboardInputHandlerSavedData = MidiDeviceAndChannelMap<boolean>;

type LocalState = Record<string, boolean>;

const QWERTY_DEVICE_NAME = 'qwerty';
const QWERTY_CHANNEL_NUMBER = 0;
const QWERTY_DEVICE_AND_CHANNEL = makeHashedMidiDeviceAndChannel({device: 'qwerty', channel: 0});

macroTypeRegistry.registerMacroType(
    'musical_keyboard_input',
    {},
    async (macroAPI, conf, fieldName): Promise<MusicalKeyboardInputResult> => {
        const editing = await macroAPI.statesAPI.createSharedState(getKeyForMacro('editing', fieldName), false);
        const waitingForConfiguration = await macroAPI.statesAPI.createSharedState(getKeyForMacro('waiting_for_configuration', fieldName), false);
        const capturedMidiEvent = await macroAPI.statesAPI.createSharedState<MidiEventFull | null>(getKeyForMacro('captured_midi_event', fieldName), null);
        const savedMidiEvents = await macroAPI.statesAPI.createPersistentState<MidiEventFull[]>(getKeyForMacro('saved_midi_event', fieldName), []);
        const states: InputMacroStateHolders = {
            editing,
            waiting: waitingForConfiguration,
            captured: capturedMidiEvent,
            savedMidiEvents,
        };

        const macroReturnValueFromSaver = await useInputMacroWaiterAndSaver(macroAPI, states, {includeQwerty: conf.enableQwerty}, fieldName, savedMidiInputsAreEqual);

        const macroReturnValue = {
            ...macroReturnValueFromSaver,
        };

        if (!macroAPI.isMidiMaestro()) {
            return macroReturnValue;
        }

        const defaultEventTypes = ['noteon', 'noteoff'] as MidiEvent['type'][];

        const handleMidiEvent = (event: MidiEventFull) => {
            const eventTypes = conf.eventTypes || defaultEventTypes;

            if (!eventTypes.includes(event.event.type)) {
                return;
            }

            if (event.deviceInfo.name.startsWith('IAC')) {
                return;
            }

            if (waitingForConfiguration.getState()) {
                const captured = capturedMidiEvent.getState();
                if (captured && savedMidiInputsAreEqual(captured, event)) {
                    return;
                }

                capturedMidiEvent.setState(event);
                return;
            }

            // const key = getKeyForMidiEvent(event);
            const saved = savedMidiEvents.getState();
            if (saved.find(e => savedMidiInputsAreEqual(e, event))) {
                macroReturnValue.subject.next(event);
                conf.onTrigger?.(event);
            }
        };

        const midiSubscription = macroAPI.midiIO.midiInputSubject.subscribe(handleMidiEvent);
        macroAPI.onDestroy(midiSubscription.unsubscribe);

        if (conf.enableQwerty) {
            const qwertySubscription = macroAPI.midiIO.qwertyInputSubject.subscribe((qwertyEvent => {
                const midiEvent = qwertyEventToMidiEvent(qwertyEvent, true);
                if (!midiEvent) {
                    return;
                }

                macroReturnValue.subject.next(midiEvent);
                conf.onTrigger?.(midiEvent);
            }));
            macroAPI.onDestroy(qwertySubscription.unsubscribe);
        }

        return macroReturnValue;
    },
);

export const getKeyForInputDevice = (event: MidiEventFull) => {
    return `${event.deviceInfo.name}|${event.event.channel}`;
};

export const savedMidiInputsAreEqual = (event1: MidiEventFull, event2: MidiEventFull): boolean => {
    return getKeyForInputDevice(event1) === getKeyForInputDevice(event2);
};

export const qwertyEventToMidiEvent = (event: QwertyCallbackPayload, onlyMusical: boolean): MidiEventFull | undefined => {
    let midiNumber = QWERTY_TO_MIDI_MAPPINGS[event.key as keyof typeof QWERTY_TO_MIDI_MAPPINGS];
    if (midiNumber === undefined) {
        if (onlyMusical) {
            return;
        }

        midiNumber = event.key.charCodeAt(0);
    } else {
        midiNumber += 24;
    }

    const fullEvent: MidiEventFull = {
        deviceInfo: {type: 'midi', subtype: 'midi_input', name: 'qwerty', manufacturer: ''},
        event: {
            channel: 0,
            number: midiNumber,
            type: event.event === 'keydown' ? 'noteon' : 'noteoff',
            velocity: 100, // maybe make this random or gradually change or something
        },
        type: 'midi',
    };

    return fullEvent;
};
