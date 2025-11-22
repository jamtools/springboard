import React from 'react';

import springboard from 'springboard';
import {ModuleAPI} from 'springboard/engine/module_api';

type AwaitedRecord<Obj extends Record<string, Promise<any>>> = {
    [Key in keyof Obj]: Awaited<Obj[Key]>;
};

async function promiseAllObject<Obj extends Record<string, Promise<any>>>(
    obj: Obj
): Promise<AwaitedRecord<Obj>> {
    const entries = Object.entries(obj);
    const resolvedValues = await Promise.all(entries.map(([_, promise]) => promise));

    return Object.fromEntries(entries.map(([key], index) => [key, resolvedValues[index]])) as AwaitedRecord<Obj>;
}

const createStates = async (moduleAPI: ModuleAPI) => {
    const states = await moduleAPI.shared.createSharedStates({
        myState: 'initial state',
    });
    return {
        myState: states.myState,
    };
};

const createMacros = async (moduleAPI: ModuleAPI) => {
    return promiseAllObject({
        myMacro: moduleAPI.getModule('macro').createMacro(moduleAPI, '', 'midi_button_input', {}),
    });
};

type Actions = {
    changeTheThing: (args: {newValue: string}) => void;
}

springboard.registerModule('ModuleOrSnackTemplate', {}, async (moduleAPI): Promise<ModuleOrSnackTemplateModuleReturnValue> => {
    const states = await createStates(moduleAPI);
    const macros = await createMacros(moduleAPI);

    const actions: Actions = {
        changeTheThing: moduleAPI.internal.createAction('changeTheThing', {}, async ({newValue}) => {
            states.myState.setState(newValue);
        }),
    };

    registerRoutes(moduleAPI, states, macros, actions);

    const sub = macros.myMacro.subject.subscribe(() => {

    });
    // moduleAPI.onDestroy(sub.unsubscribe);

    return {};
});

type States = Awaited<ReturnType<typeof createStates>>;
type Macros = Awaited<ReturnType<typeof createMacros>>;

const registerRoutes = (moduleAPI: ModuleAPI, states: States, macros: Macros, actions: Actions) => {
    moduleAPI.ui.registerRoute('', {}, () => {
        const myState = states.myState.useState();

        return (
            <div>
                My state: {myState.toString()}
                <button
                    onClick={() => actions.changeTheThing({
                        newValue: Math.random().toString().slice(2),
                    })}
                >
                    Change value
                </button>
            </div>
        );
    });
};

declare module 'springboard/module_registry/module_registry' {
    interface AllModules {
        ModuleOrSnackTemplate: ModuleOrSnackTemplateModuleReturnValue;
    }
}

type ModuleOrSnackTemplateModuleReturnValue = {

};
