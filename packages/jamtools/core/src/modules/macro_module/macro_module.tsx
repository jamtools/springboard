import React from 'react';

import springboard, {CoreDependencies, Module, ModuleAPI, ModuleDependencies} from 'springboard';
import {MacroConfigItem, MacroTypeConfigs} from './macro_module_types.js';
import {BaseModule, ModuleHookValue} from 'springboard/modules/base_module/base_module';
import {MacroPage} from './macro_page.js';
import {CapturedRegisterMacroTypeCall, DefinedMacroTypeDescriptor, MacroAPI, MacroCallback, RegisterMacroType} from '@jamtools/core/modules/macro_module/registered_macro_types';
import {defaultMacroTypes} from './macro_handlers/index.js';

import {macroTypeRegistry} from './registered_macro_types.js';

type ModuleId = string;

export type MacroConfigState = {
    configs: Record<ModuleId, Record<string, {type: keyof MacroTypeConfigs}>>;
    producedMacros: Record<ModuleId, Record<string, any>>;
};

type MacroHookValue = ModuleHookValue<MacroModule>;

const macroContext = React.createContext<MacroHookValue>({} as MacroHookValue);

declare module 'springboard/module_registry/module_registry' {
    interface AllModules {
        macro: MacroModule;
    }
}

export class MacroModule implements Module<MacroConfigState> {
    moduleId = 'macro';

    registeredMacroTypes: CapturedRegisterMacroTypeCall[] = [];

    private localMode = false;

    /**
        This is used to determine if MIDI devices should be used client-side.
    */
    public setLocalMode = (mode: boolean) => {
        this.localMode = mode;
    };

    constructor(
        private coreDeps: CoreDependencies,
        private moduleDeps: ModuleDependencies,
        private macroTypes: DefinedMacroTypeDescriptor[] = defaultMacroTypes,
    ) { }

    routes = {
        '': {
            component: () => {
                const mod = MacroModule.use();
                return <MacroPage state={mod.state || this.state} />;
            },
        },
    };

    state: MacroConfigState = {
        configs: {},
        producedMacros: {},
    };

    public createMacro = async <MacroType extends keyof MacroTypeConfigs, T extends MacroConfigItem<MacroType>>(moduleAPI: ModuleAPI, name: string, macroType: MacroType, config: T): Promise<MacroTypeConfigs[MacroType]['output']> => {
        const moduleId = moduleAPI.internal.moduleId;

        const tempConfig = {[name]: {...config, type: macroType}};
        this.state.configs = {...this.state.configs, [moduleId]: {...this.state.configs[moduleId], ...tempConfig}};

        const result = await this.createMacroFromConfigItem(moduleAPI, macroType, config, name);

        this.state.producedMacros = {...this.state.producedMacros, [moduleId]: {...this.state.producedMacros[moduleId], [name]: result}};

        if (!result) {
            const errorMessage = `Error: unknown macro type '${macroType}'`;
            this.coreDeps.showError(errorMessage);
        }

        return result!;
    };

    public createMacros = async <
        MacroConfigs extends {
            [K in string]: {
                type: keyof MacroTypeConfigs;
            } & (
                {[T in keyof MacroTypeConfigs]: {type: T; config: MacroTypeConfigs[T]['input']}}[keyof MacroTypeConfigs]
            )
        }
    >(moduleAPI: ModuleAPI, macros: MacroConfigs): Promise<{
        [K in keyof MacroConfigs]: MacroTypeConfigs[MacroConfigs[K]['type']]['output'];
    }> => {
        const keys = Object.keys(macros);
        const promises = keys.map(async key => {
            const {type, config} = macros[key]!;
            return {
                macro: await this.createMacro(moduleAPI, key, type, config),
                key,
            };
        });

        const result = {} as {[K in keyof MacroConfigs]: MacroTypeConfigs[MacroConfigs[K]['type']]['output']};

        const createdMacros = await Promise.all(promises);
        for (const key of keys) {
            (result[key] as any) = createdMacros.find(m => m.key === key)!.macro;
        }

        return result;
    };

    public registerMacroType: RegisterMacroType = <MacroTypeId extends keyof MacroTypeConfigs, MacroTypeOptions extends object>(
        macroName: MacroTypeId,
        options: MacroTypeOptions,
        cb: MacroCallback<MacroTypeConfigs[MacroTypeId]['input'], MacroTypeConfigs[MacroTypeId]['output']>,
    ) => {
        this.registeredMacroTypes.push([macroName, options, cb]);
    };

    initialize = async () => {
        const legacyMacroCallbacks = (macroTypeRegistry.registerMacroType as unknown as {calls: CapturedRegisterMacroTypeCall[]}).calls || [];
        macroTypeRegistry.registerMacroType = this.registerMacroType;

        for (const macroType of this.macroTypes) {
            this.registerMacroType(macroType.macroTypeId, macroType.options, macroType.initialize);
        }

        for (const macroType of legacyMacroCallbacks) {
            this.registerMacroType(...macroType);
        }

        const allConfigs = {...this.state.configs};
        const allProducedMacros = {...this.state.producedMacros};
        this.setState({configs: allConfigs, producedMacros: allProducedMacros});
    };

    private createMacroFromConfigItem = async <MacroType extends keyof MacroTypeConfigs>(moduleAPI: ModuleAPI, macroType: MacroType, conf: MacroConfigItem<typeof macroType>, fieldName: string): Promise<MacroTypeConfigs[MacroType]['output'] | undefined> => {
        const registeredMacroType = this.registeredMacroTypes.find(mt => mt[0] === macroType);
        if (!registeredMacroType) {
            return undefined;
        }

        const macroAPI: MacroAPI = {
            midiIO: moduleAPI.getModule('io'),
            createAction: (...args) => {
                const action = moduleAPI.internal.createAction(...args);
                return (args: any) => action(args, this.localMode ? {mode: 'local'} : undefined);
            },
            statesAPI: {
                createSharedState: async <State,>(key: string, defaultValue: State) => {
                    if (this.localMode) {
                        const states = await moduleAPI.userAgent.createUserAgentStates({[key]: defaultValue});
                        return states[key]!;
                    } else {
                        const states = await moduleAPI.shared.createSharedStates({[key]: defaultValue});
                        return states[key]!;
                    }
                },
            },
            createMacro: this.createMacro,
            isMidiMaestro: () => this.coreDeps.isMaestro() || this.localMode,
            moduleAPI,
            onDestroy: (cb: () => void) => {
                moduleAPI.internal.onDestroy(cb);
            },
        };

        const result = await registeredMacroType[2](macroAPI, conf, fieldName);
        return result;
    };

    Provider: React.ElementType = BaseModule.Provider(this, macroContext);
    static use = BaseModule.useModule(macroContext);
    private setState = BaseModule.setState(this);
}

export const defineMacroModule = (macroTypes: DefinedMacroTypeDescriptor[] = defaultMacroTypes) => springboard.defineModule('macro', {}, async (moduleAPI) => {
    const mod = new MacroModule(moduleAPI.internal.coreDeps, moduleAPI.internal.modDeps, macroTypes);
    await mod.initialize();
    return mod;
});

export const macroModule = defineMacroModule();
