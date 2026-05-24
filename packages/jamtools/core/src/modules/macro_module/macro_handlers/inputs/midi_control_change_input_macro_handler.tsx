import React from 'react';
import {Subject} from 'rxjs';

import {MidiEventFull} from '../../macro_module_types';
import {getKeyForMacro, InputMacroStateHolders, useInputMacroWaiterAndSaver, savedMidiEventsAreEqual, getKeyForMidiEvent, MidiInputMacroPayload} from './input_macro_handler_utils';
import {macroTypeRegistry} from '../../registered_macro_types';

type MacroConfigItemMidiControlChangeInput = {
    onTrigger?(midiEvent: MidiEventFull): void;
    allowLocal?: boolean;
}

export type MidiControlChangeInputResult = MidiInputMacroPayload;

declare module '../../macro_module_types' {
    interface MacroTypeConfigs {
        midi_control_change_input: {
            input: MacroConfigItemMidiControlChangeInput;
            output: MidiControlChangeInputResult;
        }
    }
}

macroTypeRegistry.registerMacroType('midi_control_change_input', {}, async (macroAPI, conf, fieldName) => {
    const editing = await macroAPI.statesAPI.createSharedState(getKeyForMacro('editing', fieldName), false);
    const waitingForConfiguration = await macroAPI.statesAPI.createSharedState(getKeyForMacro('waiting_for_configuration', fieldName), false);
    const capturedMidiEvent = await macroAPI.statesAPI.createSharedState<MidiEventFull | null>(getKeyForMacro('captured_midi_event', fieldName), null);
    const savedMidiEvents = await macroAPI.statesAPI.createSharedState<MidiEventFull[]>(getKeyForMacro('saved_midi_event', fieldName), []);
    const states: InputMacroStateHolders = {
        editing,
        waiting: waitingForConfiguration,
        captured: capturedMidiEvent,
        savedMidiEvents,
    };

    const macroReturnValue = await useInputMacroWaiterAndSaver(macroAPI, states, {}, fieldName, savedMidiEventsAreEqual);

    if (!macroAPI.isMidiMaestro() && !conf.allowLocal) {
        return macroReturnValue;
    }

    const sub = macroAPI.midiIO.midiInputSubject.subscribe(event => {
        if (event.event.type !== 'cc') {
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
    });
    macroAPI.onDestroy(sub.unsubscribe);

    return macroReturnValue;
});
