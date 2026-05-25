import React, {useEffect, useState} from 'react';

import {produce} from 'immer';
import {Subject} from 'rxjs';

import {getKeyForMacro} from './input_macro_handler_utils';
import {savedMidiInputsAreEqual} from './musical_keyboard_input_macro_handler';

import {macroTypeRegistry} from '../../registered_macro_types';

import {MidiEventFull} from '../../macro_module_types';

type MusicalKeyboardPagedOctaveInputResult = {
    subject: Subject<MidiEventFull>;
    components: {
        edit: React.ElementType;
    };
};

type MacroConfigItemMusicalKeyboardPagedOctaveInput = {
    singleOctave?: boolean;
    onTrigger?(midiEvent: MidiEventFull): void;
    enableQwerty?: boolean;
}

declare module '../../macro_module_types' {
    interface MacroTypeConfigs {
        musical_keyboard_paged_octave_input: {
            input: MacroConfigItemMusicalKeyboardPagedOctaveInput;
            output: MusicalKeyboardPagedOctaveInputResult;
        }
    }
}

type PagedOctaveInputStoredConfig = {
    octaveOffset: number;
    // beginningOctaveMidiNumber: number;
    numberOfOctaves: number;
}

const initialUserDefinedConfig: PagedOctaveInputStoredConfig = {
    octaveOffset: 4,
    // beginningOctaveMidiNumber: -1,
    numberOfOctaves: 2,
};

macroTypeRegistry.registerMacroType(
    'musical_keyboard_paged_octave_input',
    {},
    async (macroAPI, conf, fieldName): Promise<MusicalKeyboardPagedOctaveInputResult> => {
        const initialUserConfig: PagedOctaveInputStoredConfig = {
            ...initialUserDefinedConfig,
            numberOfOctaves: conf.singleOctave ? 1 : initialUserDefinedConfig.numberOfOctaves,
        };

        const pagedOctaveInputStoredConfig = await macroAPI.statesAPI.createSharedState<PagedOctaveInputStoredConfig>(getKeyForMacro('pagedOctaveInputStoredConfig', fieldName), initialUserConfig);

        const showConfigurationFormState = await macroAPI.statesAPI.createSharedState<boolean>(getKeyForMacro('pagedOctaveInputShowForm', fieldName), false);

        const subject = new Subject<MidiEventFull>();

        if (conf.onTrigger) {
            const subscription = subject.subscribe(event => {
                conf.onTrigger!(event);
            });
            macroAPI.onDestroy(subscription.unsubscribe);
        }

        const keyboardMacro = await macroAPI.createMacro(macroAPI.moduleAPI, fieldName + '|keyboard_input', 'musical_keyboard_input', {enableQwerty: conf.enableQwerty});

        const pageDownMacro = await macroAPI.createMacro(macroAPI.moduleAPI, fieldName + '|page_down', 'midi_button_input', {
            includeRelease: false,
            onTrigger: () => {
                const currentConfig = pagedOctaveInputStoredConfig.getState();

                const newState = produce(currentConfig, (draft => {
                    draft.octaveOffset = draft.octaveOffset - 1;
                }));

                pagedOctaveInputStoredConfig.setState(newState);
            },
        });

        const pageUpMacro = await macroAPI.createMacro(macroAPI.moduleAPI, fieldName + '|page_up', 'midi_button_input', {
            includeRelease: false,
            onTrigger: () => {
                const currentConfig = pagedOctaveInputStoredConfig.getState();

                const newState = produce(currentConfig, (draft => {
                    draft.octaveOffset = draft.octaveOffset + 1;
                }));

                pagedOctaveInputStoredConfig.setState(newState);
            },
        });

        const submitNumberOfOctaves = macroAPI.createAction(getKeyForMacro('pagedInput|submitNumberOfOctaves', fieldName), {}, async (args: {numberOfOctaves: number}) => {
            const currentConfig = pagedOctaveInputStoredConfig.getState();

            const newState = produce(currentConfig, (draft => {
                draft.numberOfOctaves = args.numberOfOctaves;
            }));

            pagedOctaveInputStoredConfig.setState(newState);
        });

        const keyboardSub = keyboardMacro.subject.subscribe(event => {
            const savedEvents = keyboardMacro.states.savedMidiEvents.getState();
            const matchedEvent = savedEvents.find(e => savedMidiInputsAreEqual(e, event));
            if (!matchedEvent && event.deviceInfo.name !== 'qwerty') { // TODO: qwerty hack
                return;
            }

            const beginningOctave = matchedEvent?.event.number || 24;

            const storedConfig = pagedOctaveInputStoredConfig.getState();
            const numberOfOctaves = storedConfig.numberOfOctaves;

            // if user wants to include an extra "C" at the end of the keyboard, they should select an extra octave to take that C note into account
            if ((event.event.number < beginningOctave) || (event.event.number > (beginningOctave + (numberOfOctaves * 12)) - 1)) {
                return;
            }

            const relativeNote = event.event.number - beginningOctave;
            const scaledNote = (storedConfig.octaveOffset * 12) + relativeNote;

            const result: MidiEventFull = {
                ...event,
                event: {
                    ...event.event,
                    number: scaledNote,
                },
            };
            subject.next(result);
        });
        macroAPI.onDestroy(keyboardSub.unsubscribe);

        return {
            subject,
            components: {
                edit: () => {
                    const show = showConfigurationFormState.useState();
                    const pagedOctaveConfig = pagedOctaveInputStoredConfig.useState();

                    const [numberOfOctaves, setNumberOfOctaves] = useState(pagedOctaveConfig.numberOfOctaves);

                    useEffect(() => {
                        setNumberOfOctaves(pagedOctaveConfig.numberOfOctaves);
                    }, [pagedOctaveConfig.numberOfOctaves]);

                    if (!show) {
                        return (
                            <button onClick={() => showConfigurationFormState.setState(true)}>
                                Show paged keyboard configuration
                            </button>
                        );
                    }

                    return (
                        <div>
                            <button onClick={() => showConfigurationFormState.setState(false)}>
                                Hide paged keyvboard configuration
                            </button>
                            <div>
                                Macro configs:

                                Keyboard with beginning octave:
                                <keyboardMacro.components.edit />

                                {!conf.singleOctave && (
                                    <>
                                        Number of octaves:
                                        <div>
                                            <input
                                                type='number'
                                                onChange={event => setNumberOfOctaves(parseInt(event.target.value))}
                                                value={numberOfOctaves}
                                                disabled={conf.singleOctave}
                                            />
                                            <button onClick={() => submitNumberOfOctaves({numberOfOctaves})}>
                                                Confirm
                                            </button>
                                        </div>

                                        Page down:
                                        <pageDownMacro.components.edit />

                                        Page up:
                                        <pageUpMacro.components.edit />
                                    </>
                                )}

                                Current config:
                                <pre>
                                    {JSON.stringify(pagedOctaveConfig, null, 2)}
                                </pre>
                            </div>
                        </div>
                    );
                },
            }
        };
    },
);
