import {ModuleAPI} from 'springboard/engine/module_api';
import type {StateSupervisor} from 'springboard/services/states/shared_state_service';

import type {MacroTypeConfigs} from './macro_module_types.js';
import {IoModule} from '../io/io_module.js';
import type {MacroModule} from './macro_module.js';

export type RegisterMacroTypeOptions = {

}

export type MacroAPI = {
    moduleAPI: ModuleAPI;
    midiIO: IoModule;
    statesAPI: {createSharedState: <State>(stateName: string, initialValue: State) => Promise<StateSupervisor<State>>};
    createAction: ModuleAPI['internal']['createAction'];
    isMidiMaestro: () => boolean;
    onDestroy: (cb: () => void) => void;
    createMacro: MacroModule['createMacro'];
};

export type MacroCallback<MacroInputConf extends object, MacroReturnValue extends object> = (macroAPI: MacroAPI, macroInputConf: MacroInputConf, fieldName: string) =>
Promise<MacroReturnValue> | MacroReturnValue;

export type RegisterMacroType = <MacroTypeId extends keyof MacroTypeConfigs, MacroTypeOptions extends object>(
    macroTypeId: MacroTypeId,
    options: MacroTypeOptions,
    cb: MacroCallback<MacroTypeConfigs[MacroTypeId]['input'], MacroTypeConfigs[MacroTypeId]['output']>,
) => void;

export type DefinedMacroTypeDescriptor = {
    kind: 'defineMacroType';
    macroTypeId: keyof MacroTypeConfigs;
    options: RegisterMacroTypeOptions;
    initialize: MacroCallback<any, any>;
};

export type CapturedRegisterMacroTypeCall = [keyof MacroTypeConfigs, RegisterMacroTypeOptions, MacroCallback<any, any>];

export const defineMacroType = <MacroTypeId extends keyof MacroTypeConfigs, MacroTypeOptions extends object>(
    macroTypeId: MacroTypeId,
    options: MacroTypeOptions,
    cb: MacroCallback<MacroTypeConfigs[MacroTypeId]['input'], MacroTypeConfigs[MacroTypeId]['output']>,
): DefinedMacroTypeDescriptor => ({
    kind: 'defineMacroType',
    macroTypeId,
    options,
    initialize: cb,
});

const registerMacroType = <MacroTypeId extends keyof MacroTypeConfigs, MacroOptions extends RegisterMacroTypeOptions>(
    macroName: MacroTypeId,
    options: MacroOptions,
    cb: MacroCallback<MacroTypeConfigs[MacroTypeId]['input'], MacroTypeConfigs[MacroTypeId]['output']>,
) => {
    const calls = (registerMacroType as unknown as {calls: CapturedRegisterMacroTypeCall[]}).calls || [];
    calls.push([macroName, options, cb]);
    (registerMacroType as unknown as {calls: CapturedRegisterMacroTypeCall[]}).calls = calls;
};

const clearRegisteredMacroTypes = () => {
    (registerMacroType as unknown as {calls: CapturedRegisterMacroTypeCall[]}).calls = [];
};

export const macroTypeRegistry: {
    registerMacroType: RegisterMacroType;
    reset: () => void;
} = {
    registerMacroType,
    reset: () => {
        clearRegisteredMacroTypes();
        macroTypeRegistry.registerMacroType = registerMacroType;
    },
};
