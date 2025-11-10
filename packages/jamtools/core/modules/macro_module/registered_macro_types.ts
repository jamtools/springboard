import {ModuleAPI, StatesAPI} from 'springboard/engine/module_api';

import type {MacroTypeConfigs} from './macro_module_types';
import {IoModule} from '../io/io_module';
import type {MacroModule} from './macro_module';

export type RegisterMacroTypeOptions = {

}

export type MacroAPI = {
    moduleAPI: ModuleAPI;
    midiIO: IoModule;
    statesAPI: Pick<StatesAPI, 'createSharedState'>;
    createAction: ModuleAPI['createAction'];
    isMidiMaestro: () => boolean;
    onDestroy: (cb: () => void) => void;
    createMacro: MacroModule['createMacro'];
};

export type MacroCallback<MacroInputConf extends object, MacroReturnValue extends object> = (macroAPI: MacroAPI, macroInputConf: MacroInputConf, fieldName: string) =>
Promise<MacroReturnValue> | MacroReturnValue;

type RegisterMacroType = <MacroTypeId extends keyof MacroTypeConfigs, MacroTypeOptions extends object>(
    macroTypeId: MacroTypeId,
    options: MacroTypeOptions,
    cb: MacroCallback<MacroTypeConfigs[MacroTypeId]['input'], MacroTypeConfigs[MacroTypeId]['output']>,
) => void;

export type CapturedRegisterMacroTypeCall = [string, RegisterMacroTypeOptions, MacroCallback<any, any>];

const registerMacroType = <MacroOptions extends RegisterMacroTypeOptions, MacroInputConf extends object, MacroReturnValue extends object>(
    macroName: string,
    options: MacroOptions,
    cb: MacroCallback<MacroInputConf, MacroReturnValue>,
) => {
    const calls = (registerMacroType as unknown as {calls: CapturedRegisterMacroTypeCall[]}).calls || [];
    calls.push([macroName, options, cb]);
    (registerMacroType as unknown as {calls: CapturedRegisterMacroTypeCall[]}).calls = calls;
};

export const macroTypeRegistry: {
    registerMacroType: RegisterMacroType;
    reset: () => void;
} = {
    registerMacroType,
    reset: () => {
        macroTypeRegistry.registerMacroType = registerMacroType;
    },
};
