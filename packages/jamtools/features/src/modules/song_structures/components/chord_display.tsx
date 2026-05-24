import React from 'react';
import {MIDI_NUMBER_TO_NOTE_NAME_MAPPINGS} from '@jamtools/core/constants/midi_number_to_note_name_mappings';

export type ChordChoice = {
    root: number;
    quality: 'major' | 'minor';
};

type Props = {
    chord: ChordChoice;
}

export const ChordDisplay = (props: Props) => {
    const cycled = (props.chord.root % 12) as keyof typeof MIDI_NUMBER_TO_NOTE_NAME_MAPPINGS;
    const noteName = MIDI_NUMBER_TO_NOTE_NAME_MAPPINGS[cycled];

    return (
        <div
            style={{
                display: 'inline-block',
                margin: '10px',
                fontSize: '30px',
                border: '1px solid',
            }}
        >
            {noteName} {props.chord.quality}
        </div>
    );
};
