import React from 'react';

import {ModuleAPI} from 'springboard/engine/module_api';
import {MidiEvent, MidiEventFull} from '@jamtools/core/modules/macro_module/macro_module_types';
import {playChord, ChordWithName, noteNames} from './chord_player';
import {OutputMidiDevice} from '@jamtools/core/modules/macro_module/macro_handlers/outputs/musical_keyboard_output_macro_handler';
import {QRCode} from '../../../components/QRCode';

type SingleOctaveRootModeSupervisorMidiState = {
    currentlyHeldDownInputNotes: MidiEvent[];
    currentSustainingChord: ChordWithName | null;
    currentChordRoot: number | null;
    scaleRoot: number;
    choosingScale: boolean;
};

const muteKeyboard = (midiOutput: OutputMidiDevice) => {
    for (let i = 0; i < 84; i++) {
        midiOutput.send({
            number: i,
            type: 'noteoff',
        });
    }
};

export class SingleOctaveRootModeSupervisor {
    private macros!: Awaited<ReturnType<SingleOctaveRootModeSupervisor['createMacros']>>;
    private states!: Awaited<ReturnType<SingleOctaveRootModeSupervisor['createStates']>>;
    private actions!: ReturnType<SingleOctaveRootModeSupervisor['createActions']>;

    private midiState: SingleOctaveRootModeSupervisorMidiState = {
        currentlyHeldDownInputNotes: [],
        currentSustainingChord: null,
        currentChordRoot: null,
        scaleRoot: 0,
        choosingScale: false,
    };

    private handleNoteOnForSustainedKeyboard = (event: MidiEvent) => {
        // uncomment for regular non-chord hold mode
        // this.macros.sustainedOutput.send(event);
        // return

        if (this.midiState.choosingScale) {
            this.midiState = {
                ...this.midiState,
                scaleRoot: event.number % 12,
                choosingScale: false,
            };
            return;
        }

        const newChord = playChord(this.midiState.scaleRoot, event.number, this.midiState.currentSustainingChord, this.macros.sustainedOutput);


        if (newChord) {
            this.midiState = {
                ...this.midiState,
                currentSustainingChord: newChord,
            };
        }
    };

    private handleNoteOffForSustainedKeyboard = (event: MidiEvent) => {
        // no-op
    };

    private toggleChooseScale = () => {
        this.midiState = {
            ...this.midiState,
            choosingScale: !this.midiState.choosingScale
        };

        setTimeout(() => {
            if (this.states.enableDebugging.getState()) {
                this.states.debugMidiState.setState(this.midiState);
            }
        });
    };

    private handleNoteOnForStaccatoChord = (event: MidiEvent) => {
        // TODO: play chord
        // this.macros.stacattoOutput.send(event);
        playChord(this.midiState.scaleRoot, event.number, null, this.macros.stacattoOutput);
    };

    private handleNoteOffForStaccatoChord = (event: MidiEvent) => {
        muteKeyboard(this.macros.stacattoOutput);
    };

    private handleNoteOnForMonoBass = (event: MidiEvent) => {
        // TODO: make sure this is a good octave. gotta allow octaves on outputs
        // this.macros.monoBassOutput.send(event);

        if (event.number === this.midiState.currentChordRoot) {
            return;
        }

        if (this.midiState.currentChordRoot) {
            this.macros.monoBassOutput.send({type: 'noteoff', number: this.midiState.currentChordRoot});
        }

        this.macros.monoBassOutput.send({type: 'noteon', number: event.number});

        this.midiState = {
            ...this.midiState,
            currentChordRoot: event.number,
        };

    };

    private handleNoteOffForMonoBass = (event: MidiEvent) => {
        // this.macros.monoBassOutput.send(event);
    };

    private handleNoteOn = (event: MidiEvent) => {
        this.handleNoteOnForSustainedKeyboard(event);
        this.handleNoteOnForStaccatoChord(event);
        this.handleNoteOnForMonoBass(event);

        if (!this.midiState.currentlyHeldDownInputNotes.find(e => e.number === event.number)) {
            this.midiState = {
                ...this.midiState,
                currentlyHeldDownInputNotes: [
                    ...this.midiState.currentlyHeldDownInputNotes,
                    event,
                ],
            };
        }
    };

    private handleNoteOff = (event: MidiEvent) => {
        this.handleNoteOffForSustainedKeyboard(event);
        this.handleNoteOffForStaccatoChord(event);
        this.handleNoteOffForMonoBass(event);

        this.midiState = {
            ...this.midiState,
            currentlyHeldDownInputNotes: this.midiState.currentlyHeldDownInputNotes.filter(e => {
                return e.number !== event.number;
            }),
        };
    };

    private handleKeyboardNote = async (fullEvent: MidiEventFull) => {
        const event = fullEvent.event;

        if (event.type === 'noteon') {
            this.handleNoteOn(event);
        } else if (event.type === 'noteoff') {
            this.handleNoteOff(event);
        } else {
            return;
        }

        setTimeout(() => {
            if (this.states.enableDebugging.getState()) {
                this.states.debugSavedInputEvent.setState(fullEvent);
                this.states.debugMidiState.setState(this.midiState);
            }
        });
    };

    private createActions = () => ({
        toggleDebugging: this.moduleAPI.internal.createAction(`${this.kvPrefix}|toggleDebugging`, {}, async () => {
            console.log('toggling debug mode', !this.states.enableDebugging.getState());
            this.states.enableDebugging.setState(!this.states.enableDebugging.getState());
        }),
    });

    public renderKiosk: React.ElementType = () => {
        const debugMidiState = this.states.debugMidiState.useState();

        return (
            <>
                <this.renderScaleAndChords
                    debugMidiState={debugMidiState}
                />
                <this.renderDiscordLink/>
            </>
        );
    };

    private renderScaleAndChords = ({debugMidiState}: {debugMidiState: SingleOctaveRootModeSupervisorMidiState}) => {
        const smallFont = {fontSize: '48px', margin: '0px'};
        const bigFont = {fontSize: '96px', margin: '0px'};

        const hrMargin = '40px';

        return (
            <>
                <h3 style={smallFont}>
                    Scale:
                </h3>
                <h1 style={bigFont}>
                    {noteNames[debugMidiState.scaleRoot]} Major
                </h1>
                <hr
                    style={{marginTop: hrMargin, marginBottom: hrMargin}}
                />
                <h3 style={smallFont}>
                    Chord:
                </h3>
                <h1 style={bigFont}>
                    {debugMidiState.currentSustainingChord?.name || 'None'}
                </h1>
            </>
        );
    };

    private renderDiscordLink = () => {
        const discordLinkStyle: React.CSSProperties = {position: 'absolute', right: '20px', fontSize: '40px'};

        const url = 'jam.tools/discord';

        return (
            <>
                <a style={discordLinkStyle}>
                    {url}
                </a>

                <QRCode
                    url={`https://${url}`}
                    style={{position: 'absolute', right: '400px', height: '200px'}}
                />
            </>
        );
    };

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
                <this.renderScaleAndChords
                    debugMidiState={debugMidiState}
                />
            </>
        );
    };

    private renderDebugData = ({debugSavedInputEvent, enableDebugging, debugMidiState}: {debugSavedInputEvent: MidiEventFull | null, enableDebugging: boolean, debugMidiState: SingleOctaveRootModeSupervisorMidiState}) => {
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
                        <p>Single octave root mode input:</p>
                        <div>
                            <this.macros.singleOctaveInput.components.edit />
                        </div>

                        <p>Sustained output:</p>
                        <div>
                            <this.macros.sustainedOutput.components.edit />
                        </div>

                        <p>Sustained output mute:</p>
                        <div>
                            <this.macros.sustainedOutputMute.components.edit />
                            <this.macros.sustainedOutputMute.components.show />
                        </div>

                        <p>Stacatto output:</p>
                        <div>
                            <this.macros.stacattoOutput.components.edit />
                        </div>

                        <p>Monobass output:</p>
                        <div>
                            <this.macros.monoBassOutput.components.edit />
                        </div>

                        <p>Scale chooser:</p>
                        <div>
                            <this.macros.chooseScaleButton.components.edit />
                            <this.macros.chooseScaleButton.components.show />
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

        const singleOctaveInput = await this.moduleAPI.getModule('macro').createMacro(this.moduleAPI, makeMacroName('singleOctaveInput'), 'musical_keyboard_paged_octave_input', {
            singleOctave: true,
            enableQwerty: true,
            onTrigger: (event) => {
                this.handleKeyboardNote(event);
            },
        });

        const sustainedOutputMute = await this.moduleAPI.getModule('macro').createMacro(this.moduleAPI, makeMacroName('sustainedOutputMute'), 'midi_button_input', {
            onTrigger: () => {
                this.midiState = {
                    ...this.midiState,
                    currentSustainingChord: null,
                    currentChordRoot: null,
                };

                muteKeyboard(this.macros.sustainedOutput);
                muteKeyboard(this.macros.monoBassOutput);
            },
        });

        const sustainedOutput = await this.moduleAPI.getModule('macro').createMacro(this.moduleAPI, makeMacroName('sustainedOutput'), 'musical_keyboard_output', {});

        const stacattoOutput = await this.moduleAPI.getModule('macro').createMacro(this.moduleAPI, makeMacroName('stacattoOutput'), 'musical_keyboard_output', {});
        const monoBassOutput = await this.moduleAPI.getModule('macro').createMacro(this.moduleAPI, makeMacroName('monoBassOutput'), 'musical_keyboard_output', {});

        const chooseScaleButton = await this.moduleAPI.getModule('macro').createMacro(this.moduleAPI, makeMacroName('chooseScaleButton'), 'midi_button_input', {
            onTrigger: () => {
                this.toggleChooseScale();
            },
        });

        return {
            singleOctaveInput,
            sustainedOutputMute,
            sustainedOutput,
            stacattoOutput,
            monoBassOutput,
            chooseScaleButton,
        } as const;
    };

    private createStates = async () => {
        const makeStateName = (name: string) => `${this.kvPrefix}|${name}`;

        const [
            enableDebugging,
            debugSavedInputEvent,
            debugMidiState,
        ] = await Promise.all([
            this.moduleAPI.shared.createSharedStates({[makeStateName('enableDebugging')]: true}).then(s => s[makeStateName('enableDebugging')]),
            this.moduleAPI.shared.createSharedStates({[makeStateName('debugSavedInputEvent')]: null as MidiEventFull | null}).then(s => s[makeStateName('debugSavedInputEvent')]),
            this.moduleAPI.shared.createSharedStates({[makeStateName('debugMidiState')]: this.midiState as SingleOctaveRootModeSupervisorMidiState}).then(s => s[makeStateName('debugMidiState')]),
        ]);

        return {
            enableDebugging,
            debugSavedInputEvent,
            debugMidiState,
        };
    };
}
