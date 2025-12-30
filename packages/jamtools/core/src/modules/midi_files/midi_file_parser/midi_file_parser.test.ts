import fs from 'node:fs';
import path from 'node:path';

const midiFilePath = path.join(__dirname, '3-MIDI 1.mid');
const midiFileContent = fs.readFileSync(midiFilePath);

import type midi from 'midi-file';

import {MidiFileParser} from './midi_file_parser';

describe('midi_file_parser', () => {
    const expected = {
        'events': [
            {
                'notes': [
                    {
                        'midiNumber': 65
                    },
                    {
                        'midiNumber': 71
                    }
                ]
            },
            {
                'notes': [
                    {
                        'midiNumber': 71
                    }
                ]
            },
            {
                'notes': [
                    {
                        'midiNumber': 67
                    },
                    {
                        'midiNumber': 71
                    }
                ]
            },
            {
                'notes': [
                    {
                        'midiNumber': 71
                    }
                ]
            }
        ]
    };

    it('@tonejs/midi should parse into NoteCluster objects', () => {
        const parser = new MidiFileParser();
        const result = parser.parseWithTonejsMidiBuffer(midiFileContent);

        expect(result).toBeTruthy();
        expect(result).toEqual(expected);
    });

    it('midi-file should parse into NoteCluster objects', () => {
        const parser = new MidiFileParser();
        const result = parser.parseFromData(midiData as midi.MidiData);

        expect(result).toBeTruthy();
        expect(result).toEqual(expected);
    });
});

const midiData = {
    'header': {
        'format': 0,
        'numTracks': 1,
        'ticksPerBeat': 96
    },
    'tracks': [
        [
            {
                'deltaTime': 0,
                'meta': true,
                'type': 'trackName',
                'text': '3-MIDI 1\u0000'
            },
            {
                'deltaTime': 0,
                'meta': true,
                'type': 'timeSignature',
                'numerator': 4,
                'denominator': 4,
                'metronome': 36,
                'thirtyseconds': 8
            },
            {
                'deltaTime': 0,
                'meta': true,
                'type': 'timeSignature',
                'numerator': 4,
                'denominator': 4,
                'metronome': 36,
                'thirtyseconds': 8
            },
            {
                'deltaTime': 142,
                'channel': 0,
                'type': 'noteOn',
                'noteNumber': 65,
                'velocity': 100
            },
            {
                'deltaTime': 7,
                'channel': 0,
                'type': 'noteOn',
                'noteNumber': 71,
                'velocity': 100
            },
            {
                'deltaTime': 16,
                'channel': 0,
                'type': 'noteOff',
                'noteNumber': 65,
                'velocity': 64
            },
            {
                'deltaTime': 3,
                'channel': 0,
                'type': 'noteOff',
                'noteNumber': 71,
                'velocity': 64
            },
            {
                'deltaTime': 34,
                'channel': 0,
                'type': 'noteOn',
                'noteNumber': 71,
                'velocity': 100
            },
            {
                'deltaTime': 20,
                'channel': 0,
                'type': 'noteOff',
                'noteNumber': 71,
                'velocity': 64
            },
            {
                'deltaTime': 36,
                'channel': 0,
                'type': 'noteOn',
                'noteNumber': 67,
                'velocity': 100
            },
            {
                'deltaTime': 5,
                'channel': 0,
                'type': 'noteOn',
                'noteNumber': 71,
                'velocity': 100
            },
            {
                'deltaTime': 11,
                'channel': 0,
                'type': 'noteOff',
                'noteNumber': 67,
                'velocity': 64
            },
            {
                'deltaTime': 6,
                'channel': 0,
                'type': 'noteOff',
                'noteNumber': 71,
                'velocity': 64
            },
            {
                'deltaTime': 32,
                'channel': 0,
                'type': 'noteOn',
                'noteNumber': 71,
                'velocity': 100
            },
            {
                'deltaTime': 17,
                'channel': 0,
                'type': 'noteOff',
                'noteNumber': 71,
                'velocity': 64
            },
            {
                'deltaTime': 0,
                'meta': true,
                'type': 'endOfTrack'
            }
        ]
    ]
};
