import '@jamtools/core/modules/macro_module/macro_module';

import React from 'react';

import {ScaleDegreeInfo, cycle, getScaleDegreeFromScaleAndNote} from './root_mode_types';

import {RootModeComponent} from './root_mode_component';
import springboard from 'springboard';

type ChordState = {
    chord: ScaleDegreeInfo | null;
    note: number | null;
    scale: number;
}

springboard.registerModule('Main', {}, async (moduleAPI) => {
    const states = await moduleAPI.createStates({
        chords: {chord: null, note: null, scale: 0} as ChordState,
    });

    const rootModeState = states.chords;

    const setScale = (newScale: number) => {
        rootModeState.setState({
            chord: null,
            note: null,
            scale: newScale,
        });
    };

    moduleAPI.registerRoute('', {}, () => {
        const state = rootModeState.useState();

        const onClick = () => {
            setScale(cycle(state.scale + 1));
        };

        return (
            <RootModeComponent
                {...state}
                onClick={onClick}
            />
        );
    });

    const macroModule = moduleAPI.getModule('macro');

    const {input, output} = await macroModule.createMacros(moduleAPI, {
        input: {type: 'musical_keyboard_input', config: {}},
        output: {type: 'musical_keyboard_output', config: {}},
    });

    input.subject.subscribe(evt => {
        const midiNumber = evt.event.number;
        const scale = rootModeState.getState().scale;

        const scaleDegreeInfo = getScaleDegreeFromScaleAndNote(scale, midiNumber);
        if (!scaleDegreeInfo) {
            return;
        }

        const chordNotes = getChordFromRootNote(scale, midiNumber);
        if (!chordNotes.length) {
            return;
        }

        for (const noteNumber of chordNotes) {
            const midiNumberToPlay = noteNumber;
            output.send({...evt.event, number: midiNumberToPlay});
        }

        if (evt.event.type === 'noteon') {
            rootModeState.setState({
                chord: scaleDegreeInfo,
                note: midiNumber,
                scale,
            });
        } else if (evt.event.type === 'noteoff') {
            if (rootModeState.getState().note !== midiNumber) {
                return;
            }

            rootModeState.setState({
                chord: null,
                note: null,
                scale,
            });
        }
    });
});

const getChordFromRootNote = (scale: number, rootNote: number): number[] => {
    const scaleDegreeInfo = getScaleDegreeFromScaleAndNote(scale, rootNote);

    if (!scaleDegreeInfo) {
        return [];
    }

    // This function could be made more interesting by performing inversions to keep notes in range
    if (scaleDegreeInfo.quality === 'major') {
        return [
            rootNote,
            rootNote + 4,
            rootNote + 7,
            rootNote + 12,
        ];
    }

    if (scaleDegreeInfo.quality === 'minor') {
        return [
            rootNote,
            rootNote + 3,
            rootNote + 7,
            rootNote + 12,
        ];
    }

    return [];
};
