import React from 'react';

import {StateSupervisor} from 'springboard/services/states/shared_state_service';
import {AddingOutputDeviceState, Edit, SavedOutputDeviceState} from './components/output_macro_edit';
import {SoundfontPeripheral} from '../../../../peripherals/outputs/soundfont_peripheral';
import {BaseMidiEventPayload} from '@jamtools/core/modules/macro_module/macro_module_types';
import {MacroAPI} from '@jamtools/core/modules/macro_module/registered_macro_types';

export type OutputMacroStateHolders = {
    editing: StateSupervisor<boolean>;
    adding: StateSupervisor<AddingOutputDeviceState>;
    savedMidiOutputs: StateSupervisor<SavedOutputDeviceState[]>;
};

export type MidiOutputMacroPayload<MidiEventPayload extends BaseMidiEventPayload = BaseMidiEventPayload> = {
    components: {
        edit: React.ElementType;
    };
    send: (midiEvent: MidiEventPayload) => void;
    states: OutputMacroStateHolders;
}

type OutputMacroSaverOptions = {
    includeSoundfont?: boolean;
    includeNote?: boolean;
};

type CheckSavedMidiOutputsAreEqual = (state1: SavedOutputDeviceState, state2: SavedOutputDeviceState) => boolean;

export const useOutputMacroWaiterAndSaver = async (macroAPI: MacroAPI, states: OutputMacroStateHolders, options: OutputMacroSaverOptions, fieldName: string, checkSavedMidiOutputsAreEqual: CheckSavedMidiOutputsAreEqual): Promise<MidiOutputMacroPayload> => {
    const ioModule = macroAPI.midiIO;
    const editingState = states.editing;

    const createAction = <Args extends object>(actionName: string, cb: (args: Args) => void) => {
        return macroAPI.createAction(`macro|${fieldName}|${actionName}`, {}, async (args: Args) => {
            return cb(args);
        });
    };

    const addingOutputDevice = states.adding;
    const savedOutputDevices = states.savedMidiOutputs;

    const onClickOutput = createAction('on_click_available_output', async (args: {device: string}) => {
        addingOutputDevice.setState({device: args.device, channel: 1});
    });

    let soundfontResult: SoundfontPeripheral | undefined;
    if (options.includeSoundfont) {
        if (savedOutputDevices.getState().find(output => output.device === 'soundfont')) {
            soundfontResult = new SoundfontPeripheral();
            setTimeout(() => {
                soundfontResult!.initialize();
            });
        }
    }

    const onClickSoundfont = createAction('on_click_soundfont', async () => {
        addingOutputDevice.setState({
            channel: 1,
            device: 'soundfont',
        });
    });

    const onChooseChannel = createAction('on_choose_channel', async (args: {channel: string}) => {
        const state = addingOutputDevice.getState();
        addingOutputDevice.setState({device: state.device, channel: parseInt(args.channel)});
    });

    const onChooseNote = createAction('on_choose_note', async (args: {note: string}) => {
        const state = addingOutputDevice.getState();
        addingOutputDevice.setState({device: state.device, channel: state.channel, note: parseInt(args.note)});
    });

    const saveOutputDevice = (state: SavedOutputDeviceState) => {
        // TODO: de-dupe
        const saved = savedOutputDevices.getState();
        savedOutputDevices.setState([...saved, state]);

        addingOutputDevice.setState({device: null, channel: null});
    };

    const onConfirm = createAction('on_confirm', async () => {
        // TODO: use zod
        const state = addingOutputDevice.getState();
        if (!state.device) {
            throw new Error('no device selected');
        }
        if (!state.channel && state.channel !== 0) {
            throw new Error('no channel selected');
        }
        if (!state.note && options.includeNote) {
            throw new Error('no note selected');
        }

        const newState: SavedOutputDeviceState = {
            channel: state.channel,
            device: state.device,
            note: state.note,
        };

        const currentPersisted = savedOutputDevices.getState();
        if (currentPersisted.find(savedDevice => checkSavedMidiOutputsAreEqual(savedDevice, newState))) {
            throw new Error('already saved that midi input');
        }

        if (newState.device === 'soundfont') {
            soundfontResult = new SoundfontPeripheral();
            setTimeout(() => {
                soundfontResult!.initialize();
            });
        }

        saveOutputDevice(newState);
    });

    const onConfirmDeleteSavedDevice = createAction('on_confirm_delete_saved_device', async (args: SavedOutputDeviceState) => {
        const state = savedOutputDevices.getState();
        const index = state.findIndex(o => o.device === args.device && o.channel === args.channel);
        if (index === -1) {
            throw new Error(`no saved output device found to delete '${args.device}'`);
        }

        savedOutputDevices.setState([
            ...state.slice(0, index),
            ...state.slice(index + 1),
        ]);

        if (args.device === 'soundfont') {
            if (soundfontResult) {
                soundfontResult.destroy();
            }
        }
    });

    const askToDelete = (device: SavedOutputDeviceState) => {
        if (confirm('delete thing ' + device.device + '|' + device.channel)) {
            onConfirmDeleteSavedDevice(device);
        }
    };

    const onEdit = createAction('begin_edit', () => {
        editingState.setState(true);
    });

    const onCancelEdit = createAction('cancel_edit', () => {
        editingState.setState(false);
    });

    const components = {
        edit: () => {
            const midiDevices = ioModule.midiDeviceState.useState();
            const queuedDevice = addingOutputDevice.useState();
            const saved = savedOutputDevices.useState();
            const editing = editingState.useState();

            return (
                <Edit
                    onChooseNote={options.includeNote ? (note: string) => onChooseNote({note}) : undefined}
                    editing={editing}
                    onEdit={() => onEdit({})}
                    onCancelEdit={() => onCancelEdit({})}
                    askToDelete={askToDelete}
                    availableMidiOutputs={midiDevices.midiOutputDevices}
                    onChooseChannel={(channel: string) => onChooseChannel({channel})}
                    onClickOutput={(device: string) => onClickOutput({device})}
                    onClickSoundfont={options.includeSoundfont ? () => onClickSoundfont({}) : undefined}
                    onConfirm={() => onConfirm({})}
                    queuedDevice={queuedDevice}
                    savedDevices={saved}
                />
            );
        },
    };

    const send = (midiEvent: BaseMidiEventPayload) => {
        const saved = savedOutputDevices.getState();
        for (const device of saved) {
            if (device.device === 'soundfont') {
                soundfontResult?.send(midiEvent);
                continue;
            }

            ioModule.sendMidiEvent(device.device, {
                ...midiEvent,
                channel: device.channel,
            });
        }
    };

    return {
        states,
        components,
        send,
    };
};

export const checkSavedMidiOutputsAreEqual = (state1: SavedOutputDeviceState, state2: SavedOutputDeviceState) => {
    return (
        state1.device === state2.device &&
        state1.channel === state2.channel &&
        state1.note === state2.note
    );
};
