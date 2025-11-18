import React from 'react';

import {getKeyForMacro} from '../inputs/input_macro_handler_utils';
import {AddingOutputDeviceState, Edit, SavedOutputDeviceState} from './components/output_macro_edit';
import {MidiOutputMacroPayload, OutputMacroStateHolders, checkSavedMidiOutputsAreEqual, useOutputMacroWaiterAndSaver} from './output_macro_handler_utils';
import {macroTypeRegistry} from '../../registered_macro_types';

type Base = Omit<MidiOutputMacroPayload, 'send'>;

export type MidiButtonOutputMacroOutput = Base & {
    send(args: {release: boolean} | {releaseTimeout: number}): void;
};

type MidiButtonOutputMacroConfig = {
};

declare module '../../macro_module_types' {
    interface MacroTypeConfigs {
        midi_button_output: {
            input: MidiButtonOutputMacroConfig;
            output: MidiButtonOutputMacroOutput;
        }
    }
}

macroTypeRegistry.registerMacroType(
    'midi_button_output',
    {},
    (async (macroAPI, inputConf, fieldName) => {
        const editingState = await macroAPI.statesAPI.createSharedState(getKeyForMacro('editing', fieldName), false);
        const addingOutputDevice = await macroAPI.statesAPI.createSharedState<AddingOutputDeviceState>(getKeyForMacro('adding_output_device', fieldName), {device: null, channel: null});
        const savedOutputDevices = await macroAPI.statesAPI.createPersistentState<SavedOutputDeviceState[]>(getKeyForMacro('saved_output_devices', fieldName), []);

        const states: OutputMacroStateHolders = {
            editing: editingState,
            adding: addingOutputDevice,
            savedMidiOutputs: savedOutputDevices,
        };

        const macroReturnValue = await useOutputMacroWaiterAndSaver(macroAPI, states, {includeNote: true}, fieldName, checkSavedMidiOutputsAreEqual);

        const ioModule = macroAPI.midiIO;

        const send = (args: {release: boolean} | {releaseTimeout: number}) => {
            const saved = savedOutputDevices.getState();
            for (const device of saved) {
                const initialEventType = 'release' in args && args.release ? 'noteoff' : 'noteon';

                ioModule.sendMidiEvent(device.device, {
                    type: initialEventType,
                    number: device.note!,
                    channel: device.channel,
                });

                if ('releaseTimeout' in args && args.releaseTimeout) {
                    setTimeout(() => {
                        ioModule.sendMidiEvent(device.device, {
                            type: 'noteoff',
                            number: device.note!,
                            channel: device.channel,
                        });
                    }, args.releaseTimeout);
                }
            }
        };

        return {
            send,
            components: macroReturnValue.components,
            states,
        };
    }),
);
