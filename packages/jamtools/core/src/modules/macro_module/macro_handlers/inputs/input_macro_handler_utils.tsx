import React from 'react';
import {Subject} from 'rxjs';

import {MidiEventFull} from '@jamtools/core/modules/macro_module/macro_module_types';
import {StateSupervisor} from 'springboard/services/states/shared_state_service';

import {Edit} from './components/edit_macro';
import {MacroAPI} from '@jamtools/core/modules/macro_module/registered_macro_types';

export type MidiInputMacroPayload = {
    states: InputMacroStateHolders;
    actions: InputMacroActions;
    subject: Subject<MidiEventFull>;
    components: {
        edit: React.ElementType;
    };
}

export const savedMidiEventsAreEqual = (event1: MidiEventFull, event2: MidiEventFull): boolean => {
    const key1 = getKeyForMidiEvent(event1);
    const key2 = getKeyForMidiEvent(event2);
    return key1 === key2;
};

export const getKeyForMidiEvent = (event: MidiEventFull) => {
    return `${event.deviceInfo.name}|${event.event.channel}|${event.event.number}`;
};

export const getKeyForMacro = (key: string, fieldName: string) => `macro|${fieldName}|${key}`;

export type InputMacroActions = {
    onEdit: () => void;
    onCancelEdit: () => void;
    confirmMacro: () => void;
    toggleWaiting: () => void;
    deleteSavedValue: (event: MidiEventFull) => void;
    askDeleteSavedValue: (event: MidiEventFull) => void;
};

export type InputMacroStateHolders = {
    editing: StateSupervisor<boolean>;
    waiting: StateSupervisor<boolean>;
    captured: StateSupervisor<MidiEventFull | null>;
    savedMidiEvents: StateSupervisor<MidiEventFull[]>;
};

type MacroSaverOptions = {
    includeQwerty?: boolean;
}

type CheckSavedMidiEventsAreEqual = (event1: MidiEventFull, event2: MidiEventFull) => boolean;

export const useInputMacroWaiterAndSaver = async (
    macroAPI: MacroAPI,
    states: InputMacroStateHolders,
    options: MacroSaverOptions,
    fieldName: string,
    checkSavedMidiEventsAreEqual: CheckSavedMidiEventsAreEqual,
): Promise<MidiInputMacroPayload> => {
    const editingState = states.editing;
    const waitingForConfiguration = states.waiting;
    const capturedMidiEvent = states.captured;
    const savedMidiEvents = states.savedMidiEvents;

    if (savedMidiEvents.getState().length) {
        macroAPI.midiIO.ensureListening();
    }

    const createAction = <Args extends object>(actionName: string, cb: (args: Args) => void) => {
        return macroAPI.createAction(`macro|${fieldName}|${actionName}`, {}, async (args: Args) => {
            return cb(args);
        });
    };

    const toggleWaiting = createAction('toggle_waiting_input', async () => {
        const currentlyWaiting = waitingForConfiguration.getState();
        if (!currentlyWaiting) {
            macroAPI.midiIO.ensureListening();
        }

        waitingForConfiguration.setState(!currentlyWaiting);
    });

    const confirmMacro = createAction('confirm_macro', async () => {
        const currentPersisted = savedMidiEvents.getState();
        const captured = capturedMidiEvent.getState();
        if (!captured) {
            throw new Error('tried to confirm macro with none captured');
        }

        if (currentPersisted.find(e => checkSavedMidiEventsAreEqual(e, captured))) {
            throw new Error('already saved that midi input');
        }

        savedMidiEvents.setState([...currentPersisted, captured]);
        waitingForConfiguration.setState(false);
        capturedMidiEvent.setState(null);
    });

    const deleteSavedValue = createAction('delete_saved_event', async (event: MidiEventFull) => {
        const key = getKeyForMidiEvent(event);
        const saved = savedMidiEvents.getState();

        const index = saved.findIndex(e => getKeyForMidiEvent(e) === key);
        if (index === -1) {
            throw new Error(`No saved value for key ${key}`);
        }

        savedMidiEvents.setState([...saved.slice(0, index), ...saved.slice(index + 1)]);
    });

    const askDeleteSavedValue = (event: MidiEventFull) => {
        if (!confirm('delete saved event?')) {
            return;
        }

        deleteSavedValue(event);
    };

    const subject = new Subject<MidiEventFull>();

    const onEdit = createAction('begin_edit', () => {
        editingState.setState(true);
    });

    const onCancelEdit = createAction('cancel_edit', () => {
        editingState.setState(false);
        waitingForConfiguration.setState(false);
        capturedMidiEvent.setState(null);
    });

    const returnValue: MidiInputMacroPayload = {
        states,
        subject,
        actions: {
            onEdit: () => {
                onEdit({});
            },
            onCancelEdit: () => onCancelEdit({}),
            confirmMacro: () => confirmMacro({}),
            toggleWaiting: () => toggleWaiting({}),
            deleteSavedValue: (event: MidiEventFull) => deleteSavedValue(event),
            askDeleteSavedValue: (event: MidiEventFull) => askDeleteSavedValue(event),
        },
        components: {
            edit: () => {
                const waiting = waitingForConfiguration.useState();
                const captured = capturedMidiEvent.useState();
                const saved = savedMidiEvents.useState();
                const editing = editingState.useState();

                return (
                    <Edit
                        editing={editing}
                        onEdit={() => onEdit({})}
                        onCancelEdit={() => onCancelEdit({})}
                        waiting={waiting}
                        captured={captured}
                        saved={saved}
                        askDeleteSavedValue={askDeleteSavedValue}
                        confirmMacro={() => confirmMacro({})}
                        toggleWaiting={() => toggleWaiting({})}
                    />
                );
            },
        },
    };

    if (!macroAPI.isMidiMaestro()) {
        return returnValue;
    }

    return returnValue;
};
