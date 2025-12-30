import React from 'react';

import {ModuleAPI} from 'springboard/engine/module_api';
import {MidiEvent, MidiEventFull} from '@jamtools/core/modules/macro_module/macro_module_types';

type MultiOctaveSupervisorMidiState = {
    currentlyHeldDownInputNotes: MidiEvent[];
};

export class MultiOctaveSupervisor {
    private macros!: Awaited<ReturnType<MultiOctaveSupervisor['createMacros']>>;
    private states!: Awaited<ReturnType<MultiOctaveSupervisor['createStates']>>;
    private actions!: ReturnType<MultiOctaveSupervisor['createActions']>;

    private midiState: MultiOctaveSupervisorMidiState = {
        currentlyHeldDownInputNotes: [],
    };

    private handleKeyboardNote = async (fullEvent: MidiEventFull) => {
        const event = fullEvent.event;

        this.macros.midiOutput.send({
            ...event,
            velocity: 127,
        });

        if (event.type === 'noteon') {
            if (!this.midiState.currentlyHeldDownInputNotes.find(e => e.number === event.number)) {
                this.midiState = {
                    ...this.midiState,
                    currentlyHeldDownInputNotes: [
                        ...this.midiState.currentlyHeldDownInputNotes,
                        event,
                    ],
                };
            }
        }

        if (event.type === 'noteoff') {
            this.midiState = {
                ...this.midiState,
                currentlyHeldDownInputNotes: this.midiState.currentlyHeldDownInputNotes.filter(e => {
                    return e.number !== event.number;
                }),
            };
        }

        setTimeout(() => {
            if (this.states.enableDebugging.getState()) {
                this.states.debugSavedInputEvent.setState(fullEvent);
                this.states.debugMidiState.setState(this.midiState);
            }
        });
    };

    private createActions = () => ({
        toggleDebugging: this.moduleAPI.createAction(`${this.kvPrefix}|toggleDebugging`, {}, async () => {
            console.log('toggling debug mode', !this.states.enableDebugging.getState());
            this.states.enableDebugging.setState(!this.states.enableDebugging.getState());
        }),
    });

    public render: React.ElementType = () => {
        const enableDebugging = this.states.enableDebugging.useState();
        const debugSavedInputEvent = this.states.debugSavedInputEvent.useState();
        const debugMidiState = this.states.debugMidiState.useState();

        return (
            <>
                <this.renderDebugData
                    enableDebugging={enableDebugging}
                    debugSavedInputEvent={debugSavedInputEvent}
                    debugMidiState={debugMidiState}
                />
            </>
        );
    };

    private renderDebugData = ({debugSavedInputEvent, enableDebugging, debugMidiState}: {debugSavedInputEvent: MidiEventFull | null, enableDebugging: boolean, debugMidiState: MultiOctaveSupervisorMidiState}) => {
        const [showDebugData, setShowDebugData] = React.useState(false);

        return (
            <>
                <button onClick={() => this.actions.toggleDebugging({})}>
                    {enableDebugging ? 'Disable debugging' : 'Enable debugging'}
                </button>

                <button onClick={() => setShowDebugData(!showDebugData)}>
                    {showDebugData ? 'Hide debug data' : 'Show debug data'}
                </button>

                {showDebugData && (
                    <>
                        <p>Paged octave input:</p>
                        <div>
                            <this.macros.pagedOctaveInput.components.edit />
                        </div>

                        <p>Paged octave output:</p>
                        <div>
                            <this.macros.midiOutput.components.edit />
                        </div>

                        {debugSavedInputEvent && (
                            <pre>
                                {JSON.stringify(debugSavedInputEvent, null, 2)}
                            </pre>
                        )}

                        {debugMidiState && (
                            <pre>
                                {JSON.stringify(debugMidiState, null, 2)}
                            </pre>
                        )}
                    </>
                )}
            </>
        );
    };

    constructor(private moduleAPI: ModuleAPI, private kvPrefix: string) { }

    public initialize = async () => {
        this.macros = await this.createMacros();
        this.states = await this.createStates();
        this.actions = this.createActions();
    };

    private createMacros = async () => {
        const makeMacroName = (name: string) => `${this.kvPrefix}|${name}`;

        const pagedOctaveInput = await this.moduleAPI.deps.module.moduleRegistry.getModule('macro').createMacro(this.moduleAPI, makeMacroName('pagedOctaveInput'), 'musical_keyboard_paged_octave_input', {
            onTrigger: (event) => {
                this.handleKeyboardNote(event);
            },
        });

        const midiOutput = await this.moduleAPI.deps.module.moduleRegistry.getModule('macro').createMacro(this.moduleAPI, makeMacroName('midiOutput'), 'musical_keyboard_output', {});

        return {
            pagedOctaveInput,
            midiOutput,
        } as const;
    };

    private createStates = async () => {
        const makeStateName = (name: string) => `${this.kvPrefix}|${name}`;

        const [
            enableDebugging,
            debugSavedInputEvent,
            debugMidiState,
        ] = await Promise.all([
            this.moduleAPI.statesAPI.createPersistentState<boolean>(makeStateName('enableDebugging'), true),
            this.moduleAPI.statesAPI.createSharedState<MidiEventFull | null>(makeStateName('debugSavedInputEvent'), null),
            this.moduleAPI.statesAPI.createSharedState<MultiOctaveSupervisorMidiState>(makeStateName('debugMidiState'), this.midiState),
        ]);

        return {
            enableDebugging,
            debugSavedInputEvent,
            debugMidiState,
        };
    };
}
