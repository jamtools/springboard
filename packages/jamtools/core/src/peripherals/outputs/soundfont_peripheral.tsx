import Soundfont from 'soundfont-player';

import {BaseMidiEventPayload, convertMidiNumberToNoteAndOctave} from '@jamtools/core/modules/macro_module/macro_module_types';

type HeldDownSoundfontNotes = {
    number: number;
    player: Soundfont.Player
};

export class SoundfontPeripheral {
    constructor() { }

    soundfont?: Soundfont.Player;
    audioContext?: AudioContext;

    private heldDownNotes: HeldDownSoundfontNotes[] = [];

    public getHeldDownNotes = (): number[] => {
        return this.heldDownNotes.map(n => n.number);
    };

    public initialize = async () => {
        // TODO: serve the soundfont file from origin instead of fetching from CDN. would probably need to fork or do babel transformation since the url is hardcoded
        // https://github.com/danigb/soundfont-player/blob/2b89587d7cc396c5c7b91056f8cb78831ead7436/dist/soundfont-player.js#L76
        return;
        // if ('AudioContext' in globalThis) {
        //     try {
        //         this.audioContext = new AudioContext();
        //         this.soundfont = await Soundfont.instrument(this.audioContext, 'percussive_organ');
        //     } catch (e) {
        //         console.error(e);
        //     }
        // }
    };

    public destroy = () => {
        this.soundfont?.stop();
        this.audioContext?.close();
    };

    // TODO: define React components in this file for choosing instruments. need Edit and Short components to show in output macro view

    public send = (midiEvent: BaseMidiEventPayload) => {
        if (!this.soundfont) {
            console.log('sending midi event from node process');
            return;
        }

        const midiNumber = midiEvent.number;

        if (midiEvent.type === 'noteon') {
            const playingNoteIndex = this.heldDownNotes.findIndex(p => p.number === midiNumber);

            if (playingNoteIndex !== -1) {
                console.log('trying to play a note thats already being played');
                return;
            }

            if (midiNumber % 1 !== 0) {
                console.log('trying to play decimal midi number');
                return;
            }

            const noteAndOctave = convertMidiNumberToNoteAndOctave(midiNumber);
            const playingNote = this.soundfont.start(noteAndOctave, undefined, {gain: (midiEvent.velocity || 0) / 32});

            this.heldDownNotes.push({number: midiNumber, player: playingNote});
            return;
        }

        if (midiEvent.type === 'noteoff') {
            const playingNoteIndex = this.heldDownNotes.findIndex(p => p.number === midiNumber);

            if (playingNoteIndex === -1) {
                return;
            }

            const playingNote = this.heldDownNotes[playingNoteIndex];
            playingNote?.player?.stop();

            this.heldDownNotes = [
                ...this.heldDownNotes.slice(0, playingNoteIndex),
                ...this.heldDownNotes.slice(playingNoteIndex + 1),
            ];
            return;
        }
    };
}
