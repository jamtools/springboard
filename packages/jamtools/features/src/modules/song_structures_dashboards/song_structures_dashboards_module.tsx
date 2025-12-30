import React from 'react';

import {Link} from 'react-router';

import springboard from 'springboard';
import {MidiEvent} from '@jamtools/core/modules/macro_module/macro_module_types';

import {GuitarChordRootsDisplay, GuitarTabView} from '@jamtools/features/modules/song_structures/components/guitar_tab_view';
import {ChordChoice, ChordDisplay} from '@jamtools/features/modules/song_structures/components/chord_display';

declare module 'springboard/module_registry/module_registry' {
    interface AllModules {
        song_structures_dashboards: SongStructuresDashboardsModuleReturnValue;
    }
}

type SongStructuresDashboardsModuleReturnValue = {

};

type GuitarDisplaySettings = {
    showGuitar: boolean;
    showLetters: boolean;
};

const initialGuitarDisplaySettings: GuitarDisplaySettings = {
    showGuitar: false,
    showLetters: false,
};

springboard.registerModule('song_structures_dashboards', {}, async (moduleAPI): Promise<SongStructuresDashboardsModuleReturnValue> => {
    const states = moduleAPI.statesAPI;
    const macros = moduleAPI.deps.module.moduleRegistry.getModule('macro');

    const state = await states.createUserAgentState('guitar_display_settings', initialGuitarDisplaySettings);

    const draftChordsState = await states.createSharedState<ChordChoice[] | null>('draft_chord_choices', null);
    const confirmedChordsState = await states.createSharedState<ChordChoice[] | null>('confirmed_chord_choices', null);

    // const draftScaleChoice = moduleAPI.statesAPI.createSharedState('', true);
    // const confirmedScaleChoise = moduleAPI.statesAPI.createSharedState('', true);

    const musicalKeyboardInputMacro = await macros.createMacro(moduleAPI, 'keyboard_in', 'musical_keyboard_input', {enableQwerty: false});
    const musicalKeyboardOutputMacro = await macros.createMacro(moduleAPI, 'keyboard_out', 'musical_keyboard_output', {});

    const toggleChordChooseMode = await macros.createMacro(moduleAPI, 'toggle_chord_choose_mode', 'midi_button_input', {enableQwerty: false});
    // const toggleChordChooseMode = moduleAPI.deps.module.moduleRegistry.getModule('macro').createMacro();
    // const toggleScaleChooseMode = moduleAPI.deps.module.moduleRegistry.getModule('macro').createMacro();

    // const messageState = await states.createSharedState('message', '');

    const currentlyHeldNotes = new Set<number>();

    musicalKeyboardInputMacro.subject.subscribe(midiEvent => {
        midiEvent.event.number = midiEvent.event.number % 12;
        if (midiEvent.event.type === 'noteon') {
            currentlyHeldNotes.add(midiEvent.event.number);
        } else {
            currentlyHeldNotes.delete(midiEvent.event.number);
        }

        const draftChords = draftChordsState.getState();
        // const draftScale = draftScaleChoice.getState();

        // if (draftScale !== null) {
        //     handleScaleChoiceInput(midiEvent.event);
        //     return;
        // }

        if (draftChords !== null) {
            if (midiEvent.event.type === 'noteon') {
                handleChordChoiceInput(midiEvent.event);
            }
            return;
        }

        handleMusicalKeyboardInput(midiEvent.event);
    });

    function handleChordChoiceInput(midiEvent: MidiEvent) {
        const heldDown = Array.from(currentlyHeldNotes);
        if (!heldDown.length || heldDown.length > 2) {
            return;
        }

        if (heldDown.length == 1) {
            // draftState.setState(state => [...state, midiEvent.event.number]);
            return;
        }

        let chord: ChordChoice;

        const diff = (12 + midiEvent.number - heldDown[0]) % 12;
        if (diff === 3) {
            chord = {
                root: heldDown[0] % 12,
                quality: 'minor',
            };
        } else if (diff === 4) {
            chord = {
                root: heldDown[0] % 12,
                quality: 'major',
            };
        } else {
            return;
        }

        const current = draftChordsState.getState() || [];
        draftChordsState.setState([...current, chord]);
    }

    function handleMusicalKeyboardInput(midiEvent: MidiEvent) {
        musicalKeyboardOutputMacro.send(midiEvent);
    }

    toggleChordChooseMode.subject.subscribe(midiEvent => {
        if (midiEvent.event.type === 'noteoff') {
            return;
        }

        const draftChords = draftChordsState.getState();
        // const draftScale = draftScaleChoice.getState();

        // if (draftScale) {
        // return;
        // }

        if (draftChords) {
            // confirm
            confirmedChordsState.setState(draftChords);
            draftChordsState.setState(null);
            // alert('confirmed')
        } else {
            // start drafting
            // alert('start drafting')
            draftChordsState.setState([]);
        }
    });

    moduleAPI.registerRoute('', {}, () => {
        return (
            <div>
                <Link to='/modules/song_structures_dashboards/bass_guitar'>
                    <button>
                        Go to Bass Guitar
                    </button>
                </Link>
            </div>
        );
    });

    moduleAPI.registerRoute('bass_guitar', {}, () => {
        const props: React.ComponentProps<typeof GuitarTabView> = {
            numberOfStrings: 4,
            chosenFrets: [
                {
                    fret: 2,
                    string: 2,
                },
                {
                    fret: 2,
                    string: 1,
                },
                {
                    fret: 5,
                    string: 2,
                },
                {
                    fret: 2,
                    string: 0,
                },
            ],
        };

        const displaySettings = state.useState();
        console.log(displaySettings);

        const draftChords = draftChordsState.useState();
        const confirmedChords = confirmedChordsState.useState();

        return (
            <>
                <div>
                    <div>
                        <button
                            onClick={() => state.setState({...state.getState(), showLetters: !state.getState().showLetters})}
                        >
                            {displaySettings.showLetters ? 'Hide' : 'Show'} {' Letters'}
                        </button>
                        <button
                            onClick={() => state.setState({...state.getState(), showGuitar: !state.getState().showGuitar})}
                        >
                            {displaySettings.showGuitar ? 'Hide' : 'Show'} {' Guitar'}
                        </button>
                    </div>
                    {displaySettings.showLetters && (
                        <div>
                            {/* <BasicGuitarTabView {...props} /> */}
                            <div>
                                Confirmed:
                                <div>
                                    {confirmedChords?.map((c, i) => (
                                        <ChordDisplay
                                            key={i}
                                            chord={c}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div>
                                Draft:
                                <div>
                                    {draftChords?.map((c, i) => (
                                        <ChordDisplay
                                            key={i}
                                            chord={c}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div>
                    {/* {displaySettings.showGuitar && (
                        <div>
                            <GuitarTabView {...props} />
                        </div>
                    )} */}
                    {displaySettings.showGuitar && (
                        <div>
                            <GuitarChordRootsDisplay
                                chords={confirmedChords || []}
                            />
                        </div>
                    )}
                </div>
            </>

        );
    });

    return {};
});
