import {musicalKeyboardInputMacroType} from './inputs/musical_keyboard_input_macro_handler.js';
import {midiControlChangeInputMacroType} from './inputs/midi_control_change_input_macro_handler.js';
import {midiButtonInputMacroType} from './inputs/midi_button_input_macro_handler.js';
import {musicalKeyboardPagedOctaveInputMacroType} from './inputs/musical_keyboard_paged_octave_input_macro_handler.js';
import {musicalKeyboardOutputMacroType} from './outputs/musical_keyboard_output_macro_handler.js';
import {midiControlChangeOutputMacroType} from './outputs/midi_control_change_output_macro_handler.js';
import {midiButtonOutputMacroType} from './outputs/midi_button_output_macro_handler.js';
import type {DefinedMacroTypeDescriptor, RegisterMacroType} from '../registered_macro_types.js';

export {
    musicalKeyboardInputMacroType,
    midiControlChangeInputMacroType,
    midiButtonInputMacroType,
    musicalKeyboardPagedOctaveInputMacroType,
    musicalKeyboardOutputMacroType,
    midiControlChangeOutputMacroType,
    midiButtonOutputMacroType,
};

export const defaultMacroTypes: DefinedMacroTypeDescriptor[] = [
    musicalKeyboardInputMacroType,
    midiControlChangeInputMacroType,
    midiButtonInputMacroType,
    musicalKeyboardPagedOctaveInputMacroType,
    musicalKeyboardOutputMacroType,
    midiControlChangeOutputMacroType,
    midiButtonOutputMacroType,
];

export const registerDefaultMacroTypes = (registerMacroType: RegisterMacroType) => {
    for (const macroType of defaultMacroTypes) {
        registerMacroType(macroType.macroTypeId, macroType.options, macroType.initialize);
    }
};
