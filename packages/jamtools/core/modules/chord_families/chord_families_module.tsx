import React from 'react';

import {ScaleDegreeInfo, cycle, getScaleDegreeFromScaleAndNote, ionianScaleDegreeQualities} from './root_mode_snack/root_mode_types';

import {RootModeComponent} from './root_mode_snack/root_mode_component';
import springboard from 'springboard';

type State = {
    chord: ScaleDegreeInfo | null;
    scale: number;
}

const CHORD_QUALITIES = {
    major: 'major',
    minor: 'minor',
} as const;

type ChordQuality = keyof typeof CHORD_QUALITIES;

type Chord = {
    name: string;
    quality: ChordQuality;
    notes: number[];
}

type ChordFamilyData = {
    mappings: Record<number, Chord[]>;
}

const testChordFamilyHandler = () => {
    const data: ChordFamilyData = {
        mappings: {

        },
    };
    const handler = new ChordFamilyHandler(data);

    const fromKey = handler.getChordForKeyAndNote(0, 2);
    console.log(fromKey);

    const exactNote = handler.getExactChordForNote(24);
    console.log(exactNote);
};

const getOppositeQuality = (quality: ChordQuality): ChordQuality => {
    return quality === 'major' ? 'minor' : 'major';
};

class ChordFamilyHandler {
    constructor(private data: ChordFamilyData) {}

    // this function will be used to do data entry as well. "fill in the blanks" feature for data entry
    // alternative forms of the chords too, so the user can toggle between them
    public getChordForKeyAndNote = (key: number, note: number): Chord | null => {
        const integerNotationScaleDegree = note - key;
        const quality = ionianScaleDegreeQualities[integerNotationScaleDegree];
        if (!quality) {
            // TODO: implement "out of scale" chords
            return null;
        }

        const existingMapping = this.data.mappings[note] || this.data.mappings[cycle(note)];
        if (existingMapping) {
            const qualityMatch = existingMapping.find(c => c.quality === quality);
            if (qualityMatch) {
                return qualityMatch;
            }

            const oppositeQuality = getOppositeQuality(quality);
            const oppositeQualityMatch = existingMapping.find(c => c.quality === oppositeQuality);
            if (oppositeQualityMatch) {
                // transpose minor thirds to major thirds maybe
                // return {} as Chord;
            }
        }

        // search the radius around this chord to find a nearby one

        return null;
    };

    public getExactChordForNote = (note: number): Chord | null => {
        const existingMapping = this.data.mappings[note];
        if (existingMapping?.length) {
            return existingMapping[0];
        }

        return null;
    };
}

type ChordFamiliesModuleReturnValue = {
    getChordFamilyHandler(key: string): ChordFamilyHandler;
}

declare module 'springboard/module_registry/module_registry' {
    interface AllModules {
        chord_families: ChordFamiliesModuleReturnValue;
    }
}

// springboard.registerModule('chord_families_test', {}, async (moduleAPI) => {
//     const chordFamiliesModule = moduleAPI.deps.module.moduleRegistry.getModule('chord_families');

//     const data = chordFamiliesModule.getChordFamilyHandler('mykey');
// });

springboard.registerModule('chord_families', {}, async (moduleAPI) => {
    const savedData = await moduleAPI.statesAPI.createSharedState<ChordFamilyData[]>('all_chord_families', []);

    const getChordFamilyHandler = (key: string): ChordFamilyHandler => {
        const data = savedData.getState()[0];
        return new ChordFamilyHandler(data);
    };

    const moduleReturnValue = {
        getChordFamilyHandler,
    };


    // C major on page load
    let scale = 0;

    const rootModeState = await moduleAPI.statesAPI.createSharedState<State>('state', {chord: null, scale});

    const setScale = (newScale: number) => {
        scale = newScale;
        rootModeState.setState({
            chord: null,
            scale,
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

    const macroModule = moduleAPI.deps.module.moduleRegistry.getModule('macro');

    const [input, output] = await Promise.all([
        macroModule.createMacro(moduleAPI, 'MIDI Input', 'musical_keyboard_input', {}),
        macroModule.createMacro(moduleAPI, 'MIDI Output', 'musical_keyboard_output', {}),
    ]);

    input.subject.subscribe(evt => {
        const midiNumber = evt.event.number;
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
                scale,
            });
        } else if (evt.event.type === 'noteoff') {
            // this naive logic is currently causing the second chord to disappear if the first one is released after pressing the second one
            rootModeState.setState({
                chord: null,
                scale,
            });
        }
    }); // .cleanup()

    return moduleReturnValue;
});

const getChordFromRootNote = (scale: number, rootNote: number): number[] => {
    const scaleDegreeInfo = getScaleDegreeFromScaleAndNote(scale, rootNote);

    if (!scaleDegreeInfo) {
        return [];
    }

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
