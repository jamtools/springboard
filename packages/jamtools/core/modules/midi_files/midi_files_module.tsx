import React, {useState} from 'react';

import springboard from 'springboard';
import {MidiFileParser, ParsedMidiFile} from './midi_file_parser/midi_file_parser';

declare module 'springboard/module_registry/module_registry' {
    interface AllModules {
        MidiFile: MidiFileModuleReturnValue;
    }
}

type UploadComponentProps = {
    onParsed: (data: ParsedMidiFile) => void;
}

type MidiFileModuleReturnValue = {
    components: {
        Upload: React.ElementType<UploadComponentProps>;
    };
};

springboard.registerModule('MidiFile', {}, async (moduleAPI): Promise<MidiFileModuleReturnValue> => {
    return {
        components: {
            Upload: (props: UploadComponentProps) => {
                const [parsedMidiFile, setParsedMidiFile] = useState<ParsedMidiFile | null>(null);

                const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
                    const file = event.target.files?.[0];

                    if (file) {
                        const reader = new FileReader();

                        reader.onload = function (e) {
                            const content = e.target!.result;
                            const parser = new MidiFileParser();
                            if (!content) {
                                console.error('');
                                return;
                            }
                            const buffer = Buffer.from(content as ArrayBuffer);
                            const parsed = parser.parseWithTonejsMidiBuffer(buffer);
                            setParsedMidiFile(parsed);
                        };

                        reader.readAsArrayBuffer(file);
                    } else {
                        console.error('No file selected');
                    }
                };

                const handleFormSubmission = () => {
                    if (!parsedMidiFile) {
                        return;
                    }

                    props.onParsed(parsedMidiFile);
                };

                return (
                    <div>
                        <div>
                            <input
                                type='file'
                                onChange={handleFile}
                            />
                        </div>
                        <div>
                            <button
                                onClick={handleFormSubmission}
                                disabled={!parsedMidiFile}
                            >
                                Submit
                            </button>
                        </div>
                    </div>

                );
            },
        },
    };
});
