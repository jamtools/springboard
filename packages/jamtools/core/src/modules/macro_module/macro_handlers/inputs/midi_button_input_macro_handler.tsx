import React from 'react';
import {Subject} from 'rxjs';

import {MidiEventFull} from '../../macro_module_types';
import {getKeyForMacro, InputMacroStateHolders, useInputMacroWaiterAndSaver, savedMidiEventsAreEqual, getKeyForMidiEvent, MidiInputMacroPayload} from './input_macro_handler_utils';
import {qwertyEventToMidiEvent, savedMidiInputsAreEqual} from './musical_keyboard_input_macro_handler';
import {macroTypeRegistry} from '../../registered_macro_types';

type MacroConfigItemMidiButtonInput = {
    onTrigger?(midiEvent: MidiEventFull): void;
    allowLocal?: boolean;
    enableQwerty?: boolean;
    includeRelease?: boolean;
}

type Base = Omit<MidiInputMacroPayload, 'components'>;

export type MidiButtonInputResult = Base & {
    components: {
        edit: React.ElementType;
        show: React.ElementType;
    };
};

declare module '../../macro_module_types' {
    interface MacroTypeConfigs {
        midi_button_input: {
            input: MacroConfigItemMidiButtonInput;
            output: MidiButtonInputResult;
        }
    }
}

macroTypeRegistry.registerMacroType('midi_button_input', {}, async (macroAPI, conf, fieldName) => {
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

    const initialMacroReturnValue = await useInputMacroWaiterAndSaver(macroAPI, states, {includeQwerty: conf.enableQwerty}, fieldName, savedMidiEventsAreEqual);

    const onPress = macroAPI.createAction(getKeyForMacro('onPress', fieldName), {}, async () => {
        const event: MidiEventFull = {
            type: 'ui',
            deviceInfo: {
                manufacturer: '',
                name: 'UI',
                subtype: 'midi_input',
                type: 'midi',
            },
            event: {
                number: 0,
                type: 'noteon',
                channel: 1,
            }
        };

        macroReturnValue.subject.next(event);
        conf.onTrigger?.(event);
    });

    const macroReturnValue: MidiButtonInputResult = {
        ...initialMacroReturnValue,
        components: {
            ...initialMacroReturnValue.components,
            show: () => (
                <button
                    onClick={() => onPress({})}
                >
                    Action {fieldName.split('|').pop()}
                </button>
            ),
        }
    };

    if (!macroAPI.isMidiMaestro()) {
        return macroReturnValue;
    }

    const handleMidiEvent = (event: MidiEventFull) => {
        if (event.event.type !== 'noteon' && event.event.type !== 'noteoff') {
            return;
        }

        if (!conf.includeRelease && event.event.type === 'noteoff') {
            return;
        }

        if (event.deviceInfo.name.startsWith('IAC')) {
            return;
        }

        if (waitingForConfiguration.getState()) {
            const captured = capturedMidiEvent.getState();
            if (captured && savedMidiEventsAreEqual(captured, event)) {
                return;
            }

            capturedMidiEvent.setState(event);
            return;
        }

        const key = getKeyForMidiEvent(event);
        const saved = savedMidiEvents.getState();
        if (saved.find(e => getKeyForMidiEvent(e) === key)) {
            macroReturnValue.subject.next(event);
            conf.onTrigger?.(event);
        }
    };

    const midiSubscription = macroAPI.midiIO.midiInputSubject.subscribe(handleMidiEvent);
    macroAPI.onDestroy(midiSubscription.unsubscribe);

    if (conf.enableQwerty) {
        const qwertySubscription = macroAPI.midiIO.qwertyInputSubject.subscribe((qwertyEvent => {
            const midiEvent = qwertyEventToMidiEvent(qwertyEvent, false);
            if (!midiEvent) {
                return;
            }

            handleMidiEvent(midiEvent);
        }));
        macroAPI.onDestroy(qwertySubscription.unsubscribe);
    }

    return macroReturnValue;
});
