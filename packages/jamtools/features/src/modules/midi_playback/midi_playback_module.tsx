import React from 'react';

import springboard from 'springboard';
import {defineRoute, defineRoutes} from 'springboard/router';

import {ParsedMidiFile} from '@jamtools/core/modules/midi_files/midi_file_parser/midi_file_parser';

import '@jamtools/core/modules/midi_files/midi_files_module';

declare module 'springboard/register' {
    interface RegisteredModules {
        MidiPlayback: MidiPlaybackModuleReturnValue;
    }
}

type MidiPlaybackModuleReturnValue = {
    routes: ReturnType<typeof defineRoutes>;
};

springboard.registerModule('MidiPlayback', {}, async (moduleAPI): Promise<MidiPlaybackModuleReturnValue> => {
    const midiFileModule = moduleAPI.getModule('MidiFile');

    const states = await moduleAPI.shared.createSharedStates({
        savedMidiFileData: null as ParsedMidiFile | null,
    });
    const savedMidiFileData = states.savedMidiFileData;

    const outputDevice = await moduleAPI.getModule('macro').createMacro(moduleAPI, 'outputDevice', 'musical_keyboard_output', {});

    let currentIndex = -1;

    const inputTrigger = await moduleAPI.getModule('macro').createMacro(moduleAPI, 'inputTrigger', 'midi_button_input', {onTrigger: (event) => {
        if (event.event.type !== 'noteon') {
            return;
        }

        const midiData = savedMidiFileData.getState();
        if (!midiData) {
            throw new Error('no saved midi data');
        }

        currentIndex = (currentIndex + 1) % midiData.events.length;

        const clusterToSend = midiData.events[currentIndex]!;

        for (const note of clusterToSend.notes) {
            outputDevice.send({
                type: 'noteon',
                number: note.midiNumber,
                velocity: 100, // TODO: record velocity of midi notes from midi file
            });
        }

        setTimeout(() => {
            for (const note of clusterToSend.notes) {
                outputDevice.send({
                    type: 'noteoff',
                    number: note.midiNumber,
                    velocity: 0,
                });
            }
        }, 100);
    }});

    const handleParsedMidiFile = moduleAPI.internal.createAction('handleParsedMidiFile', {}, async (args: {data: ParsedMidiFile}) => {
        savedMidiFileData.setState(args.data);
    });

    const MidiPlaybackRoute = () => {
        const savedState = savedMidiFileData.useState();

        return (
            <div>
                <midiFileModule.components.Upload
                    onParsed={data => handleParsedMidiFile({data})}
                />

                Input trigger:
                <inputTrigger.components.edit/>

                Output device:
                <outputDevice.components.edit/>

                {savedState?.events.map((event, clusterIndex) => (
                    <ul key={clusterIndex} style={{display: 'inline-block', border: '1px solid'}}>
                        {event.notes.map((note, noteIndex) => (
                            <li key={noteIndex}>
                                {note.midiNumber}
                            </li>
                        ))}
                    </ul>
                ))}

                {/* <pre>
                    {JSON.stringify(savedState?.events, null, 2)}
                </pre> */}
            </div>
        );
    };

    return {
        routes: defineRoutes([
            defineRoute({
                path: '/modules/MidiPlayback',
                component: MidiPlaybackRoute,
                options: {hideApplicationShell: false},
            }),
        ]),
    };
});
