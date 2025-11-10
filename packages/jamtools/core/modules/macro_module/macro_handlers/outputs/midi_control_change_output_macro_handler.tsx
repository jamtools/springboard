import React from 'react';

import {getKeyForMacro} from '../inputs/input_macro_handler_utils';
import {AddingOutputDeviceState, Edit, SavedOutputDeviceState} from './components/output_macro_edit';
import {MidiOutputMacroPayload, OutputMacroStateHolders, checkSavedMidiOutputsAreEqual, useOutputMacroWaiterAndSaver} from './output_macro_handler_utils';
import {macroTypeRegistry} from '../../registered_macro_types';

type Base = Omit<MidiOutputMacroPayload, 'send'>;

export type MidiControlChangeOutputMacroOutput = Base & {
    send(value: number): void;
};


type MidiControlChangeOutputMacroConfig = {
};

declare module '../../macro_module_types' {
    interface MacroTypeConfigs {
        midi_control_change_output: {
            input: MidiControlChangeOutputMacroConfig;
            output: MidiControlChangeOutputMacroOutput;
        }
    }
}

macroTypeRegistry.registerMacroType(
    'midi_control_change_output',
    {},
    (async (macroAPI, inputConf, fieldName) => {
        const editingState = await macroAPI.statesAPI.createSharedState(getKeyForMacro('editing', fieldName), false);
        const addingOutputDevice = await macroAPI.statesAPI.createSharedState<AddingOutputDeviceState>(getKeyForMacro('adding_output_device', fieldName), {device: null, channel: null});
        const savedOutputDevices = await macroAPI.statesAPI.createSharedState<SavedOutputDeviceState[]>(getKeyForMacro('saved_output_devices', fieldName), []);

        const states: OutputMacroStateHolders = {
            editing: editingState,
            adding: addingOutputDevice,
            savedMidiOutputs: savedOutputDevices,
        };

        const macroReturnValue = await useOutputMacroWaiterAndSaver(macroAPI, states, {includeNote: true}, fieldName, checkSavedMidiOutputsAreEqual);

        const ioModule = macroAPI.midiIO;

        const send = (value: number) => {
            const saved = savedOutputDevices.getState();
            for (const device of saved) {
                ioModule.sendMidiEvent(device.device, {
                    type: 'cc',
                    number: device.note!,
                    channel: device.channel,
                    value,
                });
            }
        };

        return {
            send,
            components: macroReturnValue.components,
            states,
        };
    }),
);
