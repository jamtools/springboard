import {MIDI_NUMBER_TO_NOTE_NAME_MAPPINGS} from '@jamtools/core/constants/midi_number_to_note_name_mappings';

export const cycle = (midiNumber: number) => midiNumber % 12;

export const ionianScaleDegreeQualities = {
    0: 'major',
    2: 'minor',
    4: 'minor',
    5: 'major',
    7: 'major',
    9: 'minor',
} as const;

export type ScaleDegreeInfo = {
    noteName: string;
    scaleDegree: number; // assumes Ionian mode and integer notation
    quality: 'major' | 'minor';
};

export const getScaleDegreeFromScaleAndNote = (scale: number, note: number): ScaleDegreeInfo | null => {
    const scaleDegreeIndex = cycle(note - scale);
    const scaleDegreeQuality = ionianScaleDegreeQualities[scaleDegreeIndex as keyof typeof ionianScaleDegreeQualities];

    if (!scaleDegreeQuality) {
        return null;
    }

    const rootNote = cycle(note);

    return {
        noteName: MIDI_NUMBER_TO_NOTE_NAME_MAPPINGS[rootNote as keyof typeof MIDI_NUMBER_TO_NOTE_NAME_MAPPINGS],
        scaleDegree: scaleDegreeIndex,
        quality: scaleDegreeQuality,
    };
};
