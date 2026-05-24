import {OutputMidiDevice} from '@jamtools/core/modules/macro_module/macro_handlers/outputs/musical_keyboard_output_macro_handler';

export type ChordNotes = number[];

export type ChordWithName = {
    notes: ChordNotes;
    name: string;
};

export const playChord = (scaleRoot: number, notePlayed: number, previousChord: ChordWithName | null, output: OutputMidiDevice): ChordWithName | null => {
    const chord = getChord(scaleRoot, notePlayed);
    if (!chord) {
        return null;
    }

    let notesToStop: ChordNotes = [];
    let notesToPlay: ChordNotes = chord.notes;

    if (previousChord) {
        notesToStop = previousChord.notes.filter(note => !chord.notes.includes(note));
        notesToPlay = chord.notes.filter(note => !previousChord.notes.includes(note));
    }

    notesToStop.forEach(note => {
        output.send({type: 'noteoff', number: note + 12});
    });

    notesToPlay.forEach(note => {
        output.send({type: 'noteon', number: note + 12});
    });

    return chord;
};

const getChord = (scaleRoot: number, notePlayed: number): ChordWithName | null => {
    const diff = ((notePlayed - scaleRoot) + 12) % 12;

    const scaleType = scaleIntervals[diff];
    if (!scaleType) {
        return null;
    }

    const chord = chordMap[notePlayed % 12]![scaleType];

    return {
        notes: chord,
        name: `${noteNames[notePlayed % 12]} ${scaleType}`,
    };
};

const scaleIntervals: Record<number, 'major' | 'minor'> = {
    0: 'major',
    2: 'minor',
    3: 'major',
    4: 'minor',
    5: 'major',
    7: 'major',
    8: 'major',
    9: 'minor',
    10: 'major',
};

export const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const chordMap: Record<number, Record<'major' | 'minor', ChordNotes>> = {
    0: { // C
        major: [36, 48, 52, 55, 60, 64], // Bass C added (MIDI 36)
        minor: [36, 48, 51, 55, 60, 63], // Bass C added
    },
    1: { // C#/Db
        major: [37, 49, 53, 56, 61, 65], // Bass C# (MIDI 37)
        minor: [37, 49, 52, 56, 61, 64], // Bass C# added
    },
    2: { // D
        major: [38, 50, 54, 57, 62, 66], // Bass D (MIDI 38)
        minor: [38, 50, 53, 57, 62, 65], // Bass D added
    },
    3: { // D#/Eb
        major: [39, 51, 55, 58, 63, 67], // Bass Eb (MIDI 39)
        minor: [39, 51, 54, 58, 63, 66], // Bass Eb added
    },
    4: { // E
        major: [40, 47, 52, 56, 59, 64], // Bass E (MIDI 40)
        minor: [40, 47, 52, 55, 59, 64], // Bass E added
    },
    5: { // F
        major: [41, 48, 53, 57, 60, 65], // Bass F (MIDI 41)
        minor: [41, 48, 53, 56, 60, 65], // Bass F added
    },
    6: { // F#/Gb
        major: [42, 49, 54, 58, 61, 66], // Bass F# (MIDI 42)
        minor: [42, 49, 54, 57, 61, 66], // Bass F# added
    },
    7: { // G
        major: [43, 47, 50, 55, 59, 67], // Bass G (MIDI 43)
        minor: [43, 46, 50, 55, 58, 67], // Bass G added
    },
    8: { // G#/Ab
        major: [44, 48, 51, 56, 60, 68], // Bass G# (MIDI 44)
        minor: [44, 47, 51, 56, 59, 68], // Bass G# added
    },
    9: { // A
        major: [33, 45, 49, 52, 57, 61, 64], // Bass A (MIDI 33)
        minor: [33, 45, 48, 52, 57, 60, 64], // Bass A added
    },
    10: { // A#/Bb
        major: [34, 46, 50, 53, 58, 62, 65], // Bass Bb (MIDI 34)
        minor: [34, 46, 49, 53, 58, 61, 65], // Bass Bb added
    },
    11: { // B
        major: [35, 47, 51, 54, 59, 63, 66], // Bass B (MIDI 35)
        minor: [35, 47, 50, 54, 59, 62, 66], // Bass B added
    }
};
