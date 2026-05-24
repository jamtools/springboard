import React from 'react';

import {MidiEventFull} from '@jamtools/core/modules/macro_module/macro_module_types';
import {getKeyForMidiEvent} from '../input_macro_handler_utils';

type CaptureFormProps = {
    waiting: boolean;
    toggleWaiting: (options: object) => void;
    confirmMacro: (options: object) => void;

    captured: MidiEventFull | null;
};
export const CaptureForm = ({waiting, toggleWaiting, confirmMacro, captured}: CaptureFormProps) => {
    return (
        <div>
            <p>
                Waiting {new String(waiting)}
            </p>
            {waiting ? (
                <>
                    <button
                        onClick={() => toggleWaiting({})}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => confirmMacro({})}
                    >
                        Confirm
                    </button>
                    <div>
                        Captured:
                        {captured && (
                            <pre data-testid={'captured_event'}>
                                {getKeyForMidiEvent(captured)}
                            </pre>
                        )}
                    </div>
                </>
            ) : (
                <button
                    onClick={() => toggleWaiting({})}
                >
                    Capture
                </button>
            )}
        </div>
    );
};
