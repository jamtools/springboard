import React from 'react';

import {MidiEventFull} from '@jamtools/core/modules/macro_module/macro_module_types';
import {getKeyForMidiEvent} from '../input_macro_handler_utils';

export type SavedMacroValues = {
    saved: MidiEventFull[];
    onClickDelete: (event: MidiEventFull) => void;
};
export const SavedMacroValues = ({saved, onClickDelete}: SavedMacroValues) => {
    return (
        <ul>
            {saved.map((event) => {
                const key = getKeyForMidiEvent(event);
                return (
                    <li key={key}>
                        {key}
                        <button
                            onClick={() => onClickDelete(event)}
                        >
                            Delete
                        </button>
                    </li>
                );
            })}
        </ul>
    );
};
